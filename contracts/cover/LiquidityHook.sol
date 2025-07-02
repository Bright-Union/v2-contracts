pragma solidity ^0.8.19;

import "../interfaces/ILiquidity.sol";
import "../interfaces/IProducts.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract LiquidityHook is ILiquidity, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint256 private constant EPOCH_DURATION = 1 days;
    uint256 private constant MAX_PREMIUM_DISTRIBUTION_EPOCHS = 30;
    uint256 private constant LEVERAGE_MULTIPLIER = 25;

    IProducts public immutable products;

    // Liquidity provider info per asset
    mapping(uint8 => mapping(address => LiquidityProvider))
        internal _liquidityProviders;

    // Total liquidity per asset
    mapping(uint8 => uint256) internal _totalLiquidity;

    // Product utilization mappings
    mapping(uint8 => mapping(uint => uint256)) internal _productUtilization; // assetId => productId => current usage

    // Premium delta changes at specific epochs (assetId => epoch => premiumDelta)
    mapping(uint8 => mapping(uint256 => int256))
        internal _premiumDistributionDeltas;

    // Premium distribution info per asset
    mapping(uint8 => PremiumDistribution) internal _premiumDistribution;

    modifier updatesPremiumDistribution(uint8 assetId) {
        _updatePremiumDistribution(assetId);
        _;
    }

    constructor(IProducts _products) {
        products = _products;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function claimRewards(
        uint8 assetId
    ) external nonReentrant updatesPremiumDistribution(assetId) {
        LiquidityProvider storage provider = _liquidityProviders[assetId][
            msg.sender
        ];

        if (provider.amount == 0) revert InsufficientLiquidity();

        _claimRewards(provider.amount, assetId, msg.sender);
    }

    function _claimRewards(
        uint256 amount,
        uint8 assetId,
        address user
    ) internal {
        uint256 _accumulatedPremiumAmount = (amount *
            _premiumDistribution[assetId].accumulatedPremiumPerShare) / 1e36;

        uint256 pending = _accumulatedPremiumAmount -
            _liquidityProviders[assetId][user].rewardDebt;

        if (pending != 0) {
            _liquidityProviders[assetId][user]
                .rewardDebt = _accumulatedPremiumAmount;

            _transferAsset(products.getAssetAddress(assetId), user, pending);

            emit RewardsClaimed(user, assetId, pending);
        }
    }

    function _onAddLiquidity(
        uint8 assetId,
        address user,
        uint256 amount
    ) internal nonReentrant updatesPremiumDistribution(assetId) {
        LiquidityProvider storage _provider = _liquidityProviders[assetId][
            user
        ];

        if (_provider.amount > 0) {
            _claimRewards(_provider.amount, assetId, user);
        }

        _provider.amount += amount;

        _totalLiquidity[assetId] += amount;

        emit LiquidityAdded(user, assetId, amount);
    }

    function _onWithdrawLiquidity(
        uint8 assetId,
        address user,
        uint256 amount
    ) internal nonReentrant updatesPremiumDistribution(assetId) {
        uint256 newTotalLiquidity = _totalLiquidity[assetId] - amount;
        uint256 newTotalLeveragedLiquidity = newTotalLiquidity *
            LEVERAGE_MULTIPLIER;

        uint256 totalAllocations = products.getTotalAssetAllocations(assetId);
        if (totalAllocations > 0) {
            // Check if withdrawal would cause over-allocation for any product
            uint productCount = products.getProductCount();
            for (uint i = 0; i < productCount; i++) {
                uint productId = i;

                uint256 allocation = products.getProductAllocation(
                    productId,
                    assetId
                );
                if (allocation == 0) continue;

                uint256 newProductCapacity = (newTotalLeveragedLiquidity *
                    allocation) / totalAllocations;

                if (
                    _productUtilization[assetId][productId] > newProductCapacity
                ) {
                    revert InsufficientLiquidity();
                }
            }
        }
        LiquidityProvider storage _provider = _liquidityProviders[assetId][
            user
        ];
        if (amount > _provider.amount) revert InsufficientLiquidity();

        _claimRewards(_provider.amount, assetId, user);

        _provider.amount -= amount;

        _totalLiquidity[assetId] = newTotalLiquidity;

        emit LiquidityRemoved(user, assetId, amount);
    }

    function _updatePremiumDistribution(uint8 assetId) private {
        if (
            _totalLiquidity[assetId] == 0 ||
            _premiumDistribution[assetId].lastPremiumDistributionEpoch == 0
        ) return;

        uint256 currentEpoch = getPremiumDistributionEpoch();

        uint256 lastEpoch = _premiumDistribution[assetId]
            .lastPremiumDistributionEpoch;

        if (currentEpoch <= lastEpoch) return;

        uint256 distributionEpoch = Math.min(
            currentEpoch,
            lastEpoch + MAX_PREMIUM_DISTRIBUTION_EPOCHS + 1
        );

        int256 currentDistribution = _premiumDistribution[assetId]
            .lastPremiumDistributionAmount;
        uint256 totalPremiumAdded = 0;

        for (uint256 i = lastEpoch + 1; i <= distributionEpoch; i++) {
            currentDistribution += _premiumDistributionDeltas[assetId][i];

            if (currentDistribution > 0) {
                totalPremiumAdded += uint256(currentDistribution);
            }
        }

        totalPremiumAdded = totalPremiumAdded / 1e18;

        if (totalPremiumAdded > 0) {
            _premiumDistribution[assetId].accumulatedPremiumPerShare +=
                (totalPremiumAdded * 1e36) /
                _totalLiquidity[assetId];
        }

        _premiumDistribution[assetId]
            .lastPremiumDistributionAmount = currentDistribution;
        _premiumDistribution[assetId]
            .lastPremiumDistributionEpoch = distributionEpoch;
    }

    function _addPremiumToDistribution(
        uint8 assetId,
        uint256 amount,
        uint32 period
    ) internal {
        if (_totalLiquidity[assetId] == 0) return;

        uint256 currentEpoch = getPremiumDistributionEpoch();

        if (_premiumDistribution[assetId].lastPremiumDistributionEpoch == 0)
            _premiumDistribution[assetId]
                .lastPremiumDistributionEpoch = currentEpoch;

        _updatePremiumDistribution(assetId);

        uint256 distributionEpochs = Math.max(1, period / EPOCH_DURATION);
        uint256 amountPerEpoch = (amount * 1e18) / distributionEpochs;

        currentEpoch += 1;
        _premiumDistributionDeltas[assetId][currentEpoch] += int256(
            amountPerEpoch
        );

        _premiumDistributionDeltas[assetId][
            currentEpoch + distributionEpochs
        ] -= int256(amountPerEpoch);

        emit PremiumAdded(assetId, amount, period);
    }

    function _transferAsset(
        address assetAddress,
        address recipient,
        uint256 amount
    ) internal {
        if (assetAddress == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(assetAddress).safeTransfer(recipient, amount);
        }
    }

    function getPremiumDistributionEpoch() internal view returns (uint256) {
        return block.timestamp / EPOCH_DURATION;
    }

    /* ========== LEVERAGE FUNCTIONS ========== */

    function getProductCapacity(
        uint8 assetId,
        uint productId
    ) public view returns (uint256) {
        uint256 allocation = products.getProductAllocation(productId, assetId);
        if (allocation == 0) return 0;

        uint256 totalAllocations = products.getTotalAssetAllocations(assetId);
        uint256 totalLeveragedLiquidity = _totalLiquidity[assetId] *
            LEVERAGE_MULTIPLIER;
        return (totalLeveragedLiquidity * allocation) / totalAllocations;
    }

    function getAvailableProductCapacity(
        uint8 assetId,
        uint productId
    ) public view returns (uint256) {
        uint256 capacity = getProductCapacity(assetId, productId);
        uint256 utilization = _productUtilization[assetId][productId];

        return capacity > utilization ? capacity - utilization : 0;
    }

    function _onPurchaseCover(
        uint8 assetId,
        uint productId,
        uint256 amount
    ) internal {
        // Check if product has allocation
        uint256 allocation = products.getProductAllocation(productId, assetId);
        require(allocation > 0, "Product has no allocation");

        // Check if product has enough capacity
        uint256 availableCapacity = getAvailableProductCapacity(
            assetId,
            productId
        );
        if (availableCapacity < amount) {
            revert InsufficientProductCapacity();
        }

        // Update utilization
        _productUtilization[assetId][productId] += amount;
        emit ProductUtilizationUpdated(
            assetId,
            productId,
            _productUtilization[assetId][productId]
        );
    }

    function _onExpireCover(
        uint8 assetId,
        uint productId,
        uint256 amount
    ) internal {
        // Update utilization
        if (_productUtilization[assetId][productId] >= amount) {
            _productUtilization[assetId][productId] -= amount;
        } else {
            delete _productUtilization[assetId][productId];
        }
        emit ProductUtilizationUpdated(
            assetId,
            productId,
            _productUtilization[assetId][productId]
        );
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getTotalLiquidity(uint8 assetId) external view returns (uint256) {
        return _totalLiquidity[assetId];
    }

    function getLiquidityProvider(
        uint8 assetId,
        address user
    ) external view returns (uint256 amount, uint256 rewardDebt) {
        LiquidityProvider storage provider = _liquidityProviders[assetId][user];
        return (provider.amount, provider.rewardDebt);
    }

    function getPendingRewards(
        uint8 assetId,
        address user
    ) external view returns (uint256) {
        LiquidityProvider memory provider = _liquidityProviders[assetId][user];
        if (provider.amount == 0) return 0;

        PremiumDistribution memory distribution = _premiumDistribution[assetId];
        uint256 accPremium = distribution.accumulatedPremiumPerShare;

        if (_totalLiquidity[assetId] > 0) {
            uint256 currentEpoch = getPremiumDistributionEpoch();
            uint256 lastEpoch = distribution.lastPremiumDistributionEpoch;

            if (currentEpoch > lastEpoch) {
                int256 currentDistribution = distribution
                    .lastPremiumDistributionAmount;

                uint256 totalPremiumAdded;

                uint256 distributionEpoch = Math.min(
                    currentEpoch,
                    lastEpoch + MAX_PREMIUM_DISTRIBUTION_EPOCHS + 1
                );
                for (
                    uint256 epoch = lastEpoch + 1;
                    epoch <= distributionEpoch;
                    epoch++
                ) {
                    currentDistribution += _premiumDistributionDeltas[assetId][
                        epoch
                    ];

                    if (currentDistribution > 0) {
                        totalPremiumAdded += uint256(currentDistribution);
                    }
                }

                totalPremiumAdded = totalPremiumAdded / 1e18;

                if (totalPremiumAdded > 0) {
                    accPremium +=
                        (totalPremiumAdded * 1e36) /
                        _totalLiquidity[assetId];
                }
            }
        }
        return ((provider.amount * accPremium) / 1e36) - provider.rewardDebt;
    }

    /* ========== FALLBACK & RECEIVE ========== */

    receive() external payable {}
    fallback() external payable {}
}
