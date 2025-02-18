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

import "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILayerZeroComposer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";
import "./INexusDistributor.sol";


contract StargateBusArrivalNexusMutual is Ownable, ILayerZeroComposer {

    address public immutable endpoint;
    INexusDistributor public immutable distributor;

    mapping(bytes32 => INexusDistributor.BuyCoverParams) public buyParams;

    struct ZippedCover {
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
        bytes swapData;
        INexusDistributor.PoolAllocationRequest[] poolAllocationRequests;
    }

    event ZipCoverReceive(bytes32 guid, address owner, bytes swapData, uint40[] poolIds, uint256[] coverAmountInAsset);
    event ZapCover(bytes32 guid);
    event CancelCover(bytes32 guid);

    constructor(address _endpoint, address _distributor) Ownable(msg.sender) {
        endpoint = _endpoint;
        distributor = INexusDistributor(_distributor);
    }

    function lzCompose(
        address _from,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable {
        require(msg.sender == endpoint, "!endpoint");
        uint256 amountLD = OFTComposeMsgCodec.amountLD(_message);
        bytes memory _composeMessage = OFTComposeMsgCodec.composeMsg(_message);
        (ZippedCover memory _zippedCoverParams) =
                            abi.decode(_composeMessage, (ZippedCover));

        buyParams[_guid] = INexusDistributor.BuyCoverParams(
            _zippedCoverParams.coverId,
            _zippedCoverParams.owner,
            _zippedCoverParams.productId,
            _zippedCoverParams.coverAsset,
            _zippedCoverParams.amount,
            _zippedCoverParams.period,
            _zippedCoverParams.maxPremiumInAsset,
            _zippedCoverParams.paymentAsset,
            _zippedCoverParams.commissionRatio,
            _zippedCoverParams.commissionDestination,
            _zippedCoverParams.ipfsData
        );

        uint _objLength = _zippedCoverParams.poolAllocationRequests.length;
        uint40[] memory _poolIds = new uint40[](_objLength);
        uint256[] memory _coverAmountInAsset = new uint256[](_objLength);
        for (uint256 i = 0; i < _objLength; i++) {
            if (!_zippedCoverParams.poolAllocationRequests[i].skip) {
                _poolIds[i] = _zippedCoverParams.poolAllocationRequests[i].poolId;
                _coverAmountInAsset[i] = _zippedCoverParams.poolAllocationRequests[i].coverAmountInAsset;
            }
        }
        emit ZipCoverReceive(_guid, _zippedCoverParams.owner, _zippedCoverParams.swapData, _poolIds, _coverAmountInAsset);
    }

    function zapCover(bytes32 _guid, bytes memory _swapData, INexusDistributor.PoolAllocationRequest[] memory poolAllocationRequests) external {
        (address _asset, uint256 _priceWithFee) = coverAmounts(_swapData);
        IERC20(_asset).approve(address(distributor), _priceWithFee);
        distributor.buyCover(buyParams[_guid], poolAllocationRequests, _swapData);

        delete buyParams[_guid];
        emit ZapCover(_guid);
    }

    function cancelCover(bytes32 _guid, bytes memory _swapData) external onlyOwner {
        (address _asset, uint256 _priceWithFee) = coverAmounts(_swapData);
        IERC20(_asset).transfer(buyParams[_guid].owner, _priceWithFee);
        delete buyParams[_guid];
        emit CancelCover(_guid);
    }

    function withdraw(address _asset, uint256 _amount) external onlyOwner {
        IERC20(_asset).transfer(msg.sender, _amount);
    }

    function coverAmounts(bytes memory _swapData) public view returns (address _asset, uint256 _priceWithFee) {
        (,,,, _asset,,,_priceWithFee) = abi.decode(
            _swapData,
            (
                address[],
                uint24[],
                string,
                uint256,
                address,
                uint256,
                uint256,
                uint256
            )
        );
    }
}
