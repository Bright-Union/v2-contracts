pragma solidity ^0.8.19;

import "../interfaces/ILiquidity.sol";
import "../interfaces/IProducts.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityHook2 is ILiquidity, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant EPOCH_DURATION = 1 days;

    IProducts public immutable products;

    // Liquidity provider info per asset
    mapping(uint8 => mapping(address => LiquidityProvider))
        private _liquidityProviders;

    // Total liquidity per asset
    mapping(uint8 => uint256) private _totalLiquidity;

    // Premium delta changes at specific epochs (assetId => epoch => premiumDelta)
    mapping(uint8 => mapping(uint256 => int256))
        private _premiumDistributionDeltas;

    // Premium distribution info per asset
    mapping(uint8 => PremiumDistribution) private _premiumDistribution;

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
        products.getAsset(assetId);

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
        uint256 _accumulatedPremiumPerShare = _premiumDistribution[assetId]
            .accumulatedPremiumPerShare / 1e18;

        uint256 pending = (amount * _accumulatedPremiumPerShare) -
            _liquidityProviders[assetId][user].rewardDebt;

        if (pending != 0) {
            _liquidityProviders[assetId][user].rewardDebt =
                amount *
                _accumulatedPremiumPerShare;

            _transferAsset(
                products.getAsset(assetId).assetAddress,
                user,
                pending
            );

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
        LiquidityProvider storage _provider = _liquidityProviders[assetId][
            user
        ];
        if (amount > _provider.amount) revert InsufficientLiquidity();

        _claimRewards(_provider.amount, assetId, user);

        _provider.amount -= amount;

        _totalLiquidity[assetId] -= amount;

        emit LiquidityRemoved(user, assetId, amount);
    }

    function _updatePremiumDistribution(uint8 assetId) private {
        if (_totalLiquidity[assetId] == 0) return;

        uint256 currentEpoch = block.timestamp / EPOCH_DURATION;
        uint256 lastEpoch = _premiumDistribution[assetId]
            .lastPremiumDistributionEpoch;

        if (currentEpoch <= lastEpoch) return;

        int256 currentDistribution = _premiumDistribution[assetId]
            .lastPremiumDistributionAmount;
        uint256 totalPremiumAdded = 0;

        for (uint256 i = lastEpoch + 1; i <= currentEpoch; i++) {
            currentDistribution += _premiumDistributionDeltas[assetId][i];

            if (currentDistribution > 0) {
                totalPremiumAdded += uint256(currentDistribution);
            }
        }


        if (totalPremiumAdded > 0) {
            _premiumDistribution[assetId].accumulatedPremiumPerShare +=
                (totalPremiumAdded * 1e18) /
                _totalLiquidity[assetId];
        }

        _premiumDistribution[assetId]
            .lastPremiumDistributionAmount = currentDistribution;
        _premiumDistribution[assetId]
            .lastPremiumDistributionEpoch = currentEpoch;


    }

    function _addPremiumToDistribution(
        uint8 assetId,
        uint256 amount,
        uint32 period
    ) internal {
        if (_totalLiquidity[assetId] == 0) return;

        _updatePremiumDistribution(assetId);

        uint256 distributionEpochs = period / EPOCH_DURATION;
        if (distributionEpochs == 0) distributionEpochs = 1;

        uint256 amountPerEpoch = amount / distributionEpochs;
        if (amountPerEpoch == 0) return;

        uint256 currentEpoch = block.timestamp / EPOCH_DURATION;

        _premiumDistributionDeltas[assetId][currentEpoch] += int256(
            amountPerEpoch
        );

        uint256 endEpoch = currentEpoch + distributionEpochs;
        _premiumDistributionDeltas[assetId][endEpoch] -= int256(amountPerEpoch);

        emit PremiumAdded(assetId, amount, period);
    }

    function _transferAsset(
        address assetAddress,
        address recipient,
        uint256 amount
    ) private {
        if (assetAddress == address(0)) {
            (bool success, ) = recipient.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(assetAddress).safeTransfer(recipient, amount);
        }
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getPendingRewards(
        uint8 assetId,
        address user
    ) external view returns (uint256) {
        LiquidityProvider memory provider = _liquidityProviders[assetId][user];
        if (provider.amount == 0) return 0;

        PremiumDistribution memory distribution = _premiumDistribution[assetId];
        uint256 accPremium = distribution.accumulatedPremiumPerShare;

        if (_totalLiquidity[assetId] > 0) {
            uint256 currentEpoch = block.timestamp / EPOCH_DURATION;
            uint256 lastEpoch = distribution.lastPremiumDistributionEpoch;

            if (currentEpoch > lastEpoch) {
                int256 currentDistribution = distribution
                    .lastPremiumDistributionAmount;
                uint256 totalPremiumAdded = 0;

                for (
                    uint256 epoch = lastEpoch + 1;
                    epoch <= currentEpoch;
                    epoch++
                ) {
                    if (_premiumDistributionDeltas[assetId][epoch] != 0) {
                        currentDistribution += _premiumDistributionDeltas[
                            assetId
                        ][epoch];
                    }

                    if (currentDistribution > 0) {
                        totalPremiumAdded += uint256(currentDistribution);
                    }
                }

                if (totalPremiumAdded > 0) {
                    accPremium +=
                        (totalPremiumAdded * 1e18) /
                        _totalLiquidity[assetId];
                }
            }
        }

        return ((provider.amount * accPremium) / 1e18) - provider.rewardDebt;
    }

    /* ========== FALLBACK & RECEIVE ========== */

    receive() external payable {}
    fallback() external payable {}
}
