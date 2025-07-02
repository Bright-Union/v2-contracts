// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../cover/LiquidityHook.sol";

contract LiquidityHookMock is LiquidityHook {
    constructor(IProducts _products) LiquidityHook(_products) {}
    
    function purchaseCover(
        uint8 assetId,
        uint productId,
        uint256 amount
    ) external {
        _onPurchaseCover(assetId, productId, amount);
    }
    
    function expireCover(
        uint8 assetId,
        uint productId,
        uint256 amount
    ) external {
        _onExpireCover(assetId, productId, amount);
    }
    
    function getProductUtilization(
        uint8 assetId,
        uint productId
    ) external view returns (uint256) {
        return _productUtilization[assetId][productId];
    }

    function addLiquidity(uint8 assetId, uint256 amount) external payable {
        if (products.getAssetAddress(assetId) == address(0)) {
            require(msg.value == amount, "Incorrect ETH value");
        } else {
            IERC20 token = IERC20(products.getAssetAddress(assetId));
            SafeERC20.safeTransferFrom(
                token,
                msg.sender,
                address(this),
                amount
            );
        }

        _onAddLiquidity(assetId, msg.sender, amount);
    }

    function withdrawLiquidity(uint8 assetId, uint256 amount) external {
        _onWithdrawLiquidity(assetId, msg.sender, amount);

        _transferAsset(products.getAssetAddress(assetId), msg.sender, amount);
    }

    function addPremiumToDistribution(
        uint8 assetId,
        uint256 amount,
        uint32 period
    ) external payable {
        if (products.getAssetAddress(assetId) == address(0)) {
            require(msg.value == amount, "Incorrect ETH value");
        } else {
            IERC20 token = IERC20(products.getAssetAddress(assetId));
            SafeERC20.safeTransferFrom(
                token,
                msg.sender,
                address(this),
                amount
            );
        }
        
        _addPremiumToDistribution(assetId, amount, period);
    }

    // Get premium distribution info for testing
    function getPremiumDistributionInfo(
        uint8 assetId
    )
        external
        view
        returns (
            uint256 accumulatedPremiumPerShare,
            int256 lastPremiumDistributionAmount,
            uint256 lastPremiumDistributionEpoch
        )
    {
        PremiumDistribution storage distribution = _premiumDistribution[assetId];
        return (
            distribution.accumulatedPremiumPerShare,
            distribution.lastPremiumDistributionAmount,
            distribution.lastPremiumDistributionEpoch
        );
    }
    
    // Get premium distribution delta at a specific epoch
    function getPremiumDistributionDelta(
        uint8 assetId,
        uint256 epoch
    ) external view returns (int256) {
        return _premiumDistributionDeltas[assetId][epoch];
    }
}
