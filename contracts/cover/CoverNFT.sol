pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/Strings.sol";
import "solady/src/tokens/ERC721.sol";
import {ICoverNFT} from "../interfaces/ICoverNFT.sol";


contract CoverNFT is ERC721, ICoverNFT {

    string internal _name;
    string internal _symbol;
    string internal _baseURI;
    uint96 internal _totalSupply;

    constructor(
        string memory _name_,
        string memory _symbol_,
        string memory _baseURI_
    ) {
        _name = _name_;
        _symbol = _symbol_;
        _baseURI = _baseURI_;
    }

    //TODO Only hook!
    function mint(address to) external returns (uint id) {
        unchecked {
            id = ++_totalSupply;
        }
        _mint(to, id);
    }

    function totalSupply() public view override returns (uint) {
        return _totalSupply;
    }

    function name() public view override returns (string memory){
        return _name;
    }

    /// @dev Returns the token collection symbol.
    function symbol() public view override returns (string memory){
        return _symbol;
    }

    /// @dev Returns the Uniform Resource Identifier (URI) for token `id`.
    function tokenURI(uint256 id) public view override returns (string memory){
        return string(abi.encodePacked(_baseURI, Strings.toString(id), ".json"));
    }

}
