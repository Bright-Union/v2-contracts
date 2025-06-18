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

struct Cover {
    address owner;
    uint24 productId;
    uint8 coverAsset;
    uint96 amount;
    uint32 startTime;
    uint32 period;
    bool active;
}

interface ICover {
    error CoverPeriodTooShort(uint256 provided, uint256 minimum);
    error CoverPeriodTooLong(uint256 provided, uint256 maximum);
    error CoverAmountIsZero();
    error AssetNotSupported();
    error InsufficientLiquidity();
    error UserHasActivePolicy();
    error PremiumPaymentFailed();
    error CoverNotFound();
    error NotCoverOwner();
    error NoModificationsRequested();
    error InvalidAssetId();
    error AssetAlreadyExists();
    error CoverHasNotExpired();

    event CoverBought(
        uint indexed coverId,
        uint productId,
        address indexed buyer
    );

    event CoverExtended(
        uint indexed coverId,
        uint96 newAmount,
        uint32 newPeriod
    );
}
