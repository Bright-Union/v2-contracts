pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IProducts.sol";

contract Products is IProducts, Ownable {
    uint public constant PRICE_DENOMINATOR = 100_00;

    ProductStruct[] internal _products;
    // productId => product name
    mapping(uint => string) internal _productNames;

    Asset[] private _assets;

    constructor(address _owner) Ownable(_owner) {}

    function setProducts(
        ProductStruct[] calldata _newProducts
    ) external onlyOwner {
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
}
