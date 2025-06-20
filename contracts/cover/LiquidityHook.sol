pragma solidity ^0.8.19;

import "../interfaces/ILiquidity.sol";
import "../interfaces/IProducts.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LiquidityHook is ILiquidity, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IProducts public immutable products;
    mapping(uint8 => mapping(address => LiquidityProvider))
        private _liquidityProviders;
    mapping(uint8 => PremiumDistribution[]) private _premiumDistributions;
    mapping(uint8 => AssetPremiumInfo) private _assetPremiumInfo;
    mapping(uint8 => uint256) private _totalLiquidity;

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
        Asset memory _asset = products.getAsset(assetId);

        LiquidityProvider storage provider = _liquidityProviders[assetId][
            msg.sender
        ];
        if (provider.amount == 0) revert NoLiquidityProvided();

        uint256 pending = ((provider.amount *
            _assetPremiumInfo[assetId].accumulatedPremiumPerShare) / 1e18) -
            provider.rewardDebt;
        if (pending == 0) revert NoRewardsToClaim();

        provider.rewardDebt =
            (provider.amount *
                _assetPremiumInfo[assetId].accumulatedPremiumPerShare) /
            1e18;

        _transferAsset(_asset.assetAddress, msg.sender, pending);

        emit RewardsClaimed(msg.sender, assetId, pending);
    }

    function _onAddLiquidity(
        uint8 assetId,
        address user,
        uint256 amount
    ) internal nonReentrant updatesPremiumDistribution(assetId) {
        LiquidityProvider storage provider = _liquidityProviders[assetId][user];

        if (provider.amount > 0) {
            uint256 pending = ((provider.amount *
                _assetPremiumInfo[assetId].accumulatedPremiumPerShare) / 1e18) -
                provider.rewardDebt;

            // Auto-claim: Transfer pending rewards to user
            if (pending > 0) {
                _transferAsset(
                    products.getAsset(assetId).assetAddress,
                    user,
                    pending
                );
            }
        }

        provider.amount += amount;
        provider.rewardDebt =
            (provider.amount *
                _assetPremiumInfo[assetId].accumulatedPremiumPerShare) /
            1e18;

        _totalLiquidity[assetId] += amount;
    }

    function _onWithdrawLiquidity(
        uint8 assetId,
        address user,
        uint256 amount
    ) internal updatesPremiumDistribution(assetId) {
        LiquidityProvider storage provider = _liquidityProviders[assetId][user];

        uint256 pending = ((provider.amount *
            _assetPremiumInfo[assetId].accumulatedPremiumPerShare) / 1e18) -
            provider.rewardDebt;

        // Auto-claim: Transfer pending rewards to user
        if (pending > 0) {
            _transferAsset(
                products.getAsset(assetId).assetAddress,
                user,
                pending
            );
        }

        provider.amount -= amount;
        provider.rewardDebt =
            (provider.amount *
                _assetPremiumInfo[assetId].accumulatedPremiumPerShare) /
            1e18;

        _totalLiquidity[assetId] -= amount;
    }

    function _updatePremiumDistribution(uint8 assetId) private {
        if (_totalLiquidity[assetId] == 0) return;

        uint256 currentTime = block.timestamp;

        if (currentTime <= _assetPremiumInfo[assetId].lastUpdateTime) return;

        // Calculate newly released premium
        uint256 newlyReleased = _calculateNewlyReleasedPremium(
            assetId,
            _assetPremiumInfo[assetId].lastUpdateTime
        );

        if (newlyReleased > 0) {
            _assetPremiumInfo[assetId].accumulatedPremiumPerShare +=
                (newlyReleased * 1e18) /
                _totalLiquidity[assetId];
        }

        _assetPremiumInfo[assetId].lastUpdateTime = currentTime;
    }

    function _calculateNewlyReleasedPremium(
        uint8 assetId,
        uint256 lastUpdateTime
    ) private view returns (uint256) {
        uint256 currentTime = block.timestamp;
        uint256 newlyReleased = 0;

        for (uint i = 0; i < _premiumDistributions[assetId].length; i++) {
            PremiumDistribution storage dist = _premiumDistributions[assetId][
                i
            ];

            if (dist.distributedAmount >= dist.totalAmount) continue;

            if (currentTime < dist.startTime) continue;

            uint256 endTime = currentTime > dist.endTime
                ? dist.endTime
                : currentTime;
            uint256 startTime = lastUpdateTime > dist.startTime
                ? lastUpdateTime
                : dist.startTime;

            if (endTime <= startTime) continue;

            uint256 totalPeriod = dist.endTime - dist.startTime;
            uint256 currentPeriod = endTime - startTime;
            uint256 amountToDistribute = (dist.totalAmount * currentPeriod) /
                totalPeriod;

            uint256 remaining = dist.totalAmount - dist.distributedAmount;
            if (amountToDistribute > remaining) {
                amountToDistribute = remaining;
            }

            newlyReleased += amountToDistribute;
        }

        return newlyReleased;
    }

    function _addPremiumToDistribution(
        uint8 assetId,
        uint256 amount,
        uint32 period
    ) internal {
        if (_totalLiquidity[assetId] == 0) return;

        _premiumDistributions[assetId].push(
            PremiumDistribution({
                startTime: block.timestamp,
                endTime: block.timestamp + period,
                totalAmount: amount,
                distributedAmount: 0
            })
        );

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
        LiquidityProvider storage provider = _liquidityProviders[assetId][user];
        if (provider.amount == 0) return 0;

        AssetPremiumInfo memory info = _assetPremiumInfo[assetId];
        uint256 accPremium = info.accumulatedPremiumPerShare;

        if (
            _totalLiquidity[assetId] > 0 &&
            block.timestamp > info.lastUpdateTime
        ) {
            uint256 newlyReleased = _calculateNewlyReleasedPremium(
                assetId,
                info.lastUpdateTime
            );
            accPremium += (newlyReleased * 1e18) / _totalLiquidity[assetId];
        }

        return ((provider.amount * accPremium) / 1e18) - provider.rewardDebt;
    }

    /* ========== FALLBACK & RECEIVE ========== */

    receive() external payable {}
    fallback() external payable {}
}
