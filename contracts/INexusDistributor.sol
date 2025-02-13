/* Copyright (C) 2025 BrightUnion.io

  This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

  This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/ */

pragma solidity ^0.8.19;

interface INexusDistributor {

    struct BuyCoverParams {
        uint256 coverId;
        address owner;
        uint24 productId;
        uint8 coverAsset;
        uint96 amount;
        uint32 period;
        uint256 maxPremiumInAsset;
        uint8 paymentAsset;
        uint16 commissionRatio;
        address commissionDestination;
        string ipfsData;
    }

    struct PoolAllocationRequest {
        uint40 poolId;
        bool skip;
        uint256 coverAmountInAsset;
    }

    function buyCover(
        BuyCoverParams memory params,
        PoolAllocationRequest[] memory poolAllocationRequests,
        bytes calldata swapData
    ) external payable;
}
