pragma solidity ^0.8.19;

interface ICoverNFT {

    function mint(address to) external returns (uint tokenId);

    function totalSupply() external view returns (uint);

}
