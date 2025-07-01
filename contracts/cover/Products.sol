pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IProducts.sol";

contract Products is IProducts, Ownable {
    uint public constant PRICE_DENOMINATOR = 100_00;

    ProductStruct[] internal _products;
    // productId => product name
    mapping(uint => string) internal _productNames;

    // Asset allocations as relative weights
    mapping(uint => mapping(uint8 => uint256)) internal assetAllocations; // product id,asset id,allocation

    // Track total allocations per asset
    mapping(uint8 => uint256) private _totalAssetAllocations;

    Asset[] private _assets;

    constructor(address _owner) Ownable(_owner) {}

    function setProducts(
        ProductStruct[] calldata _newProducts,
        uint8[][] calldata assetIds,
        uint256[][] calldata allocations
    ) external onlyOwner {
        require(
            _newProducts.length == assetIds.length &&
                assetIds.length == allocations.length,
            "Length mismatch"
        );

        for (uint i = 0; i < _newProducts.length; i++) {
            ProductStruct calldata param = _newProducts[i];
            //existing product?
            if (param.productId < _products.length) {
                ProductStruct storage newProductValue = _products[
                    param.productId
                ];
                newProductValue.productName = param.productName;
                newProductValue.nmProductId = param.nmProductId;
                newProductValue.ipfsMetadata = param.ipfsMetadata;
                newProductValue.price = param.price;
                newProductValue.coverAssets = param.coverAssets;
                newProductValue.isDeprecated = param.isDeprecated;
                _productNames[param.productId] = param.productName;

                _setProductAllocations(
                    param.productId,
                    param.coverAssets,
                    assetIds[i],
                    allocations[i]
                );

                emit ProductUpdated(param.productId);
            } else {
                uint productId = _products.length;
                _productNames[productId] = param.productName;
                _products.push(param);
                emit ProductSet(productId);
            }
        }
    }

    function addAsset(
        address assetAddress,
        bool isCoverAsset
    ) external onlyOwner {
        _assets.push(Asset(assetAddress, isCoverAsset));
    }

    function calculatePremium(
        uint coverAmount,
        uint period,
        uint productId
    ) public view returns (uint) {
        uint premiumPerYear = (coverAmount * _products[productId].price) /
            PRICE_DENOMINATOR;
        return (premiumPerYear * period) / 365 days;
    }

    function getProduct(
        uint productId
    ) external view returns (ProductStruct memory) {
        return _products[productId];
    }

    function getProductName(
        uint productId
    ) external view returns (string memory) {
        return _productNames[productId];
    }

    function getProductCount() public view returns (uint) {
        return _products.length;
    }

    function getProducts() external view returns (ProductStruct[] memory) {
        return _products;
    }

    function getAsset(uint assetId) external view returns (Asset memory) {
        if (assetId >= _assets.length) {
            revert AssetNotFound(assetId);
        }
        return _assets[assetId];
    }

    function getAssetAddress(uint assetId) external view returns (address) {
        if (assetId >= _assets.length) {
            revert AssetNotFound(assetId);
        }
        return _assets[assetId].assetAddress;
    }

    function getProductAllocation(
        uint productId,
        uint8 assetId
    ) external view returns (uint256) {
        if (productId >= _products.length) return 0;
        return assetAllocations[productId][assetId];
    }

    function getTotalProductAllocations(
        uint8 assetId
    ) external view returns (uint256) {
        return _totalAssetAllocations[assetId];
    }

    function _resetProductAllocations(
        uint productId,
        uint32 coverAssets
    ) internal {
        // Reset existing allocations
        for (uint8 i = 0; i < 32; i++) {
            // max 32 assets due to bitmap
            if ((coverAssets & (1 << i)) > 0) {
                // Subtract existing allocation from total
                _totalAssetAllocations[i] -= assetAllocations[productId][i];
                // Reset allocation to 0
                assetAllocations[productId][i] = 0;
            }
        }
    }

    function _setProductAllocations(
        uint productId,
        uint32 coverAssets,
        uint8[] calldata assetIds,
        uint256[] calldata allocations
    ) internal {
        _resetProductAllocations(productId, coverAssets);

        for (uint i = 0; i < assetIds.length; i++) {
            uint8 assetId = assetIds[i];
            if ((coverAssets & (1 << assetId)) > 0) {
                assetAllocations[productId][assetId] = allocations[i];
                _totalAssetAllocations[assetId] += allocations[i];
            }
        }
    }
}
