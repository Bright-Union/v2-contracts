// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../cover/RiskCoverHook.sol";

contract RiskCoverHookMock is RiskCoverHook {
    constructor(ICoverNFT _coverNFT, IProducts _products) 
        RiskCoverHook(_coverNFT, _products) 
    {}

    function addLiquidity(uint8 assetId, uint256 liquidityAmount) external {
        _totalLiquidity[assetId] += liquidityAmount;
    }
}
