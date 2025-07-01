pragma solidity ^0.8.19;

struct ProductStruct {
    string productName;
    uint productId;
    uint nmProductId;
    string ipfsMetadata;
    uint96 price;
    // cover assets bitmap. each bit represents whether the asset with
    // the index of that bit is enabled as a cover asset for this product
    uint32 coverAssets;
    bool isDeprecated;
}

struct Asset {
    address assetAddress;
    bool isCoverAsset;
}

interface IProducts {
    error AssetNotFound(uint assetId);

    event ProductSet(uint id);
    event ProductUpdated(uint id);

    function getAsset(uint assetId) external view returns (Asset memory);
    function calculatePremium(
        uint coverAmount,
        uint period,
        uint productId
    ) external view returns (uint);

    function getAssetAddress(uint assetId) external view returns (address);

    function getProductAllocation(
        uint productId,
        uint8 assetId
    ) external view returns (uint256);

    function getTotalProductAllocations(
        uint8 assetId
    ) external view returns (uint256);

    function getProductCount() external view returns (uint);
}
