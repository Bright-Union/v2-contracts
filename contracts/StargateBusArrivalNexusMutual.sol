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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILayerZeroComposer } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import { OFTComposeMsgCodec } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";


contract StargateBusArrivalNexusMutual is ILayerZeroComposer {

    address public immutable endpoint;
    address public immutable stargate;

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

    event ReceivedOnDestination(uint amountLD, uint96 amount);

    constructor(address _endpoint) {
        endpoint = _endpoint;
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

        (BuyCoverParams memory _buyCoverParams) = abi.decode(_composeMessage, (BuyCoverParams));

        emit ReceivedOnDestination(amountLD, _buyCoverParams.amount);
    }
}
