// SPDX-License-Identifier: MIT
/*  Bright Token
 *
 *  https://brightunion.ai
 *  linktr.ee/bright_union
*/

pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";

contract BrightTokenOFT is OFT {
    constructor(
        address _lzEndpoint,
        address _delegate
    ) OFT("Bright Union", "BRIGHT", _lzEndpoint, _delegate) Ownable(_delegate) {
    }
}
