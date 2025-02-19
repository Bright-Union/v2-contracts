// SPDX-License-Identifier: MIT
/*  Bright Token Ethereum Mainnet Adapter
 *
 *  https://brightunion.ai
 *  linktr.ee/bright_union
*/

pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract BrightOFTAdapter is OFTAdapter {
    constructor(
        address _lzEndpoint,
        address _owner
    ) OFTAdapter(address(0xBEaB712832112bd7664226db7CD025B153D3af55), _lzEndpoint, _owner) Ownable(_owner) {}
}
