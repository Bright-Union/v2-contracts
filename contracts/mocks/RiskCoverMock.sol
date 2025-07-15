// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../cover/RiskCover.sol";

contract RiskCoverMock is RiskCover {
    constructor(ICoverNFT _coverNFT, IProducts _products)
        RiskCover(_coverNFT, _products)
    {}

    function addLiquidity(uint8 assetId, uint256 liquidityAmount) external {
        _totalLiquidity[assetId] += liquidityAmount;
    }
}
