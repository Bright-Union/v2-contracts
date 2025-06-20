pragma solidity ^0.8.19;

struct LiquidityProvider {
    uint256 amount;
    uint256 rewardDebt;
}

struct PremiumDistribution {
    uint256 startTime;
    uint256 endTime;
    uint256 totalAmount;
    uint256 distributedAmount;
}

struct AssetPremiumInfo {
    uint256 accumulatedPremiumPerShare;
    uint256 lastUpdateTime;
}

interface ILiquidity {
    error NoLiquidityProvided();
    error NoRewardsToClaim();
    error AssetNotSupported();
    error InvalidAssetId();
    error TransferFailed();
    error InsufficientLiquidity();

    event RewardsClaimed(
        address indexed provider,
        uint8 indexed assetId,
        uint256 amount
    );
    event PremiumAdded(uint8 indexed assetId, uint256 amount, uint32 period);
}
