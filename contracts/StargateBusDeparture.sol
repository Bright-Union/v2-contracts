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

import "@stargatefinance/stg-evm-v2/src/interfaces/IStargate.sol";
import {IStargate, Ticket} from "@stargatefinance/stg-evm-v2/src/interfaces/IStargate.sol";
import {MessagingFee, OFTReceipt, SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

contract StargateBusDeparture {
    using OptionsBuilder for bytes;

    event BusDeparture(Ticket ticket);

    function prepareZipCover(
        address _stargate,
        uint32 _dstEid,
        uint256 _amount,
        address _receiver,
        bytes memory _composeMsg
    ) external view returns (uint256 valueToSend, SendParam memory sendParam, MessagingFee memory messagingFee) {
        bytes memory extraOptions = _composeMsg.length > 0
            ? OptionsBuilder.newOptions().addExecutorLzComposeOption(0, 200_000, 0)
            : bytes("");

        sendParam = SendParam({
            dstEid: _dstEid,
            to: addressToBytes32(_receiver),
            amountLD: _amount,
            minAmountLD: _amount,
            extraOptions: extraOptions,
            composeMsg: _composeMsg,
            oftCmd: ""
        });

        IStargate stargate = IStargate(_stargate);

        (, , OFTReceipt memory receipt) = stargate.quoteOFT(sendParam);
        sendParam.minAmountLD = receipt.amountReceivedLD;

        messagingFee = stargate.quoteSend(sendParam, false);
        valueToSend = messagingFee.nativeFee;

        if (stargate.token() == address(0x0)) {
            valueToSend += sendParam.amountLD;
        }
    }

    function zipCover(address _stargate, SendParam memory sendParam, MessagingFee memory messagingFee) external payable {
        (, , Ticket memory ticket) = IStargate(_stargate).sendToken{ value: msg.value }(sendParam, messagingFee, msg.sender);
        emit BusDeparture(ticket);
    }

    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }
}
