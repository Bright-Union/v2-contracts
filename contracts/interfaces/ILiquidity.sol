pragma solidity ^0.8.19;

struct LiquidityProvider {
    uint256 amount;
    uint256 rewardDebt;
}

struct PremiumDistribution {
    uint256 lastPremiumDistributionEpoch;
    int256 lastPremiumDistributionAmount;
    uint256 accumulatedPremiumPerShare;
}

interface ILiquidity {
    error InsufficientLiquidity();
    error TransferFailed();
    error InvalidEpoch();
    error InsufficientProductCapacity();

    event RewardsClaimed(
        address indexed provider,
        uint8 indexed assetId,
        uint256 amount
    );
    event PremiumAdded(uint8 indexed assetId, uint256 amount, uint32 period);
    event LiquidityRemoved(
        address indexed provider,
        uint8 indexed assetId,
        uint256 amount
    );
    event LiquidityAdded(
        address indexed provider,
        uint8 indexed assetId,
        uint256 amount
    );
    event ProductUtilizationUpdated(
        uint8 indexed assetId,
        uint indexed productId,
        uint256 utilization
    );

    function getProductCapacity(
        uint8 assetId,
        uint productId
    ) external view returns (uint256);

    function getAvailableProductCapacity(
        uint8 assetId,
        uint productId
    ) external view returns (uint256);
}
