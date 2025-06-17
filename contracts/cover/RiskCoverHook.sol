pragma solidity ^0.8.19;

import "../interfaces/ICover.sol";
import "../interfaces/ICoverNFT.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";


contract RiskCoverHook is ICover, ReentrancyGuard {

    /* ========== CONSTANTS ========== */
    uint private constant MAX_COVER_PERIOD = 365 days;
    uint private constant MIN_COVER_PERIOD = 28 days;

    ICoverNFT public immutable coverNFT;

    constructor(
        ICoverNFT _coverNFT
    ) {
        coverNFT = _coverNFT;
    }


    function buyCover(
        BuyCoverParams memory params
    ) external payable returns (uint coverId) {
        coverId = _buyCover(params);

        emit CoverBought(
            coverId,
            params.productId,
            msg.sender
        );
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

        //TODO
        coverId = coverNFT.mint(params.owner);


    }

}
