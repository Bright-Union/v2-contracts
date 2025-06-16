pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Products is Ownable {

    uint public constant PRICE_DENOMINATOR = 100_00;

    struct ProductStruct {
        string productName;
        uint productId;
        uint nmProductId;
        string ipfsMetadata;
        uint96 price;
        bool isDeprecated;
    }

    function calculatePremium(
        uint coverAmount,
        uint period,
        uint price
    ) public pure returns (uint) {
        uint premiumPerYear =
            coverAmount
            * price
            / PRICE_DENOMINATOR;
        return premiumPerYear * period / 365 days;
    }

}
