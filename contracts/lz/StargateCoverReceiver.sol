// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILayerZeroComposer} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroComposer.sol";
import {OFTComposeMsgCodec} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/libs/OFTComposeMsgCodec.sol";


contract StargateCoverReceiver is Ownable, ILayerZeroComposer {

    address public immutable endpoint;

    struct ZippedCover {
        uint256 coverId;
        address owner;
        uint24 productId;
        uint8 coverAsset;
        uint96 amount;
        uint32 period;
        uint256 maxPremiumInAsset;
        uint8 paymentAsset;
    }

    event ZipCoverReceive(bytes32 guid, address owner);

    constructor(address _endpoint) Ownable(msg.sender) {
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
        (ZippedCover memory _zippedCoverParams) =
                            abi.decode(_composeMessage, (ZippedCover));
        //TODO Call buyCover()
        emit ZipCoverReceive(_guid, _zippedCoverParams.owner);
    }

}
