pragma solidity ^0.8.19;

struct BuyCoverParams {
    uint coverId;
    address owner;
    uint24 productId;
    uint8 coverAsset;
    uint96 amount;
    uint32 period;
    uint premiumInAsset;
}

interface ICover  {

    error CoverPeriodTooShort(uint256 provided, uint256 minimum);
    error CoverPeriodTooLong(uint256 provided, uint256 maximum);
    error CoverAmountIsZero();

    event CoverBought(
        uint indexed coverId,
        uint productId,
        address indexed buyer
    );

}
