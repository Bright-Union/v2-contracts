pragma solidity ^0.8.19;

import "../interfaces/ICover.sol";
import "../interfaces/ICoverNFT.sol";
import "../interfaces/IProducts.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RiskCover is ICover, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ========== CONSTANTS ========== */
    uint private constant MAX_COVER_PERIOD = 365 days;
    uint private constant MIN_COVER_PERIOD = 28 days;

    ICoverNFT public immutable coverNFT;
    IProducts public immutable products;
    mapping(uint => Cover) internal _covers;
    mapping(address => uint[]) internal _userCovers;
    mapping(uint8 => uint256) internal _totalActiveCover;
    mapping(uint8 => uint256) internal _totalLiquidity;

    constructor(ICoverNFT _coverNFT, IProducts _products) {
        coverNFT = _coverNFT;
        products = _products;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function buyCover(
        BuyCoverParams memory params
    ) external payable returns (uint coverId) {
        if (params.coverId == 0) {
            coverId = _buyCover(params);
            emit CoverBought(coverId, params.productId, msg.sender);
        } else {
            coverId = params.coverId;
            _extendCover(params);
            emit CoverExtended(coverId, params.amount, params.period);
        }
    }

    function _buyCover(
        BuyCoverParams memory params
    ) internal nonReentrant returns (uint coverId) {
        if (params.period < MIN_COVER_PERIOD) {
            revert CoverPeriodTooShort(params.period, MIN_COVER_PERIOD);
        }
        if (params.period > MAX_COVER_PERIOD) {
            revert CoverPeriodTooLong(params.period, MAX_COVER_PERIOD);
        }
        if (params.amount == 0) {
            revert CoverAmountIsZero();
        }

        Asset memory _asset = products.getAsset(params.coverAsset);
        if (!_asset.isCoverAsset) revert AssetNotSupported();

        if (getAvailableLiquidity(params.coverAsset) < params.amount)
            revert InsufficientLiquidity();

        coverId = coverNFT.mint(params.owner);

        _covers[coverId] = Cover({
            owner: params.owner,
            productId: params.productId,
            coverAsset: params.coverAsset,
            amount: params.amount,
            startTime: uint32(block.timestamp),
            period: params.period,
            active: true
        });

        _userCovers[params.owner].push(coverId);

        _updateTotalCover(params.coverAsset, params.amount, true);

        uint premium = products.calculatePremium(
            params.amount,
            params.period,
            params.productId
        );

        _processPayment(_asset.assetAddress, premium);
    }

    function _extendCover(BuyCoverParams memory params) private {
        uint coverId = params.coverId;

        if (coverId > coverNFT.totalSupply() || !_covers[coverId].active)
            revert CoverNotFound();

        Cover storage existingCover = _covers[coverId];

        if (existingCover.owner != msg.sender) revert NotCoverOwner();

        if (params.coverAsset != existingCover.coverAsset)
            revert AssetNotSupported();

        bool increasingAmount = params.amount > 0;
        bool extendingPeriod = params.period > 0;

        if (!increasingAmount && !extendingPeriod)
            revert NoModificationsRequested();

        if (extendingPeriod) {
            uint32 newTotalPeriod = existingCover.period + params.period;
            if (newTotalPeriod > MAX_COVER_PERIOD)
                revert CoverPeriodTooLong(newTotalPeriod, MAX_COVER_PERIOD);
        }

        if (
            increasingAmount &&
            getAvailableLiquidity(params.coverAsset) < params.amount
        ) revert InsufficientLiquidity();

        uint premium = _calculateExtendCoverPremium(
            params.amount,
            params.period,
            params.productId,
            existingCover
        );

        _processPayment(products.getAssetAddress(params.coverAsset), premium);

        if (increasingAmount) {
            _updateTotalCover(params.coverAsset, params.amount, true);
            existingCover.amount += params.amount;
        }

        if (extendingPeriod) {
            existingCover.period += params.period;
        }
    }

    function _calculateExtendCoverPremium(
        uint amount,
        uint32 period,
        uint productId,
        Cover memory existingCover
    ) private view returns (uint totalPremium) {
        uint premium1 = 0;
        uint premium2 = 0;

        if (amount > 0) {
            uint32 remainingPeriod = existingCover.startTime +
                existingCover.period -
                uint32(block.timestamp);
            premium1 = products.calculatePremium(
                amount,
                remainingPeriod,
                productId
            );
        }

        if (period > 0) {
            premium2 = products.calculatePremium(
                existingCover.amount + amount,
                period,
                productId
            );
        }

        return premium1 + premium2;
    }

    function _processPayment(address assetAddress, uint premium) private {
        if (assetAddress == address(0)) {
            if (msg.value < premium) revert PremiumPaymentFailed();

            if (msg.value > premium) {
                (bool success, ) = msg.sender.call{value: msg.value - premium}(
                    ""
                );
                if (!success) revert PremiumPaymentFailed();
            }
        } else {
            IERC20(assetAddress).safeTransferFrom(
                msg.sender,
                address(this),
                premium
            );
        }
    }

    function _updateTotalCover(
        uint8 assetId,
        uint amount,
        bool increase
    ) private {
        if (increase) {
            _totalActiveCover[assetId] += amount;
        } else {
            _totalActiveCover[assetId] -= amount;
        }
    }

    function expireCover(uint coverId) external {
        if (coverId >= coverNFT.totalSupply()) revert CoverNotFound();

        Cover storage cover = _covers[coverId];
        if (!cover.active) revert CoverNotFound();

        uint32 expirationTime = cover.startTime + cover.period;
        if (block.timestamp < expirationTime) revert CoverHasNotExpired();

        _updateTotalCover(cover.coverAsset, cover.amount, false);

        cover.active = false;
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getCover(uint coverId) external view returns (Cover memory) {
        return _covers[coverId];
    }

    function isCoverActive(uint coverId) external view returns (bool) {
        if (coverId > coverNFT.totalSupply()) return false;

        Cover memory cover = _covers[coverId];
        return
            cover.active && (cover.startTime + cover.period) > block.timestamp;
    }

    function getUserCovers(address user) external view returns (uint[] memory) {
        return _userCovers[user];
    }

    function getTotalActiveCover(uint8 assetId) external view returns (uint) {
        return _totalActiveCover[assetId];
    }

    function getTotalLiquidity(uint8 assetId) external view returns (uint) {
        return _totalLiquidity[assetId];
    }

    function getAvailableLiquidity(uint8 assetId) public view returns (uint) {
        return
            _totalLiquidity[assetId] > _totalActiveCover[assetId]
                ? _totalLiquidity[assetId] - _totalActiveCover[assetId]
                : 0;
    }

    /* ========== FALLBACK & RECEIVE ========== */

    receive() external payable {}
    fallback() external payable {}
}
