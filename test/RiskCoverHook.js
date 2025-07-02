const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const {
  toWei,
  getCurrentBlockTimestamp,
  toBN,
  getTransactionBlock,
  advanceBlocks,
  daysToSeconds,
} = require("../helpers/utils");
const { ethers, upgrades } = require("hardhat");

const { AddressZero } = require("@ethersproject/constants");

describe("RiskCoverHook", function () {
  let owner;
  let addr1;
  let addr2;
  let addr3;

  const product = ["Aave", 0, 0, "ipfs://aave.json", 100 /* 1% */, 1, false];

  before("Setup", async () => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
  });

  async function deployRiskCoverHook() {
    const products = await ethers.deployContract("Products", [owner]);

    const coverNFT = await ethers.deployContract("CoverNFT", [
      "Cover NFT",
      "CNFT",
      "https://api.bright.union/v2/metadata/",
    ]);

    const riskCoverHook = await ethers.deployContract("RiskCoverHookMock", [
      coverNFT.target,
      products.target,
    ]);

    await products.setProducts([product], [[]], [[]]);  
    await products.addAsset(AddressZero, true);

    await riskCoverHook.addLiquidity(0, toWei("10000"));

    return { products, coverNFT, riskCoverHook };
  }

  describe("setup", () => {
    let products;
    let coverNFT;
    let riskCoverHook;

    it("should deploy contracts", async () => {
      const deployment = await loadFixture(deployRiskCoverHook);
      products = deployment.products;
      coverNFT = deployment.coverNFT;
      riskCoverHook = deployment.riskCoverHook;

      expect(await riskCoverHook.coverNFT()).to.equal(coverNFT.target);
      expect(await riskCoverHook.products()).to.equal(products.target);
    });
  });

  describe("buyCover", () => {
    let products;
    let coverNFT;
    let riskCoverHook;

    beforeEach(async () => {
      const deployment = await loadFixture(deployRiskCoverHook);
      products = deployment.products;
      coverNFT = deployment.coverNFT;
      riskCoverHook = deployment.riskCoverHook;
    });

    it("should revert with CoverPeriodTooShort", async () => {
      const MIN_COVER_PERIOD = daysToSeconds(28);
      const shortPeriod = MIN_COVER_PERIOD - 1;
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: toWei("10"),
        period: shortPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("10") }))
        .to.be.revertedWithCustomError(riskCoverHook, "CoverPeriodTooShort")
        .withArgs(shortPeriod, MIN_COVER_PERIOD);
    });

    it("should revert with CoverPeriodTooLong", async () => {
      const MAX_COVER_PERIOD = daysToSeconds(365);
      const longPeriod = MAX_COVER_PERIOD + 1;
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: toWei("10"),
        period: longPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("10") }))
        .to.be.revertedWithCustomError(riskCoverHook, "CoverPeriodTooLong")
        .withArgs(longPeriod, MAX_COVER_PERIOD);
    });

    it("should revert with CoverAmountIsZero", async () => {
      const validPeriod = daysToSeconds(30);
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: validPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "CoverAmountIsZero");
    });

    it("should revert with AssetNotFound", async () => {
      const validPeriod = daysToSeconds(30);
      const nonExistentAssetId = 99;
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: nonExistentAssetId,
        amount: toWei("1"),
        period: validPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("1") }))
        .to.be.revertedWithCustomError(products, "AssetNotFound")
        .withArgs(nonExistentAssetId);
    });

    it("should revert with AssetNotSupported", async () => {
      const validPeriod = daysToSeconds(30);
      
      await products.addAsset(AddressZero, false);
      const nonCoverAssetId = 1;
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: nonCoverAssetId,
        amount: toWei("1"),
        period: validPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "AssetNotSupported");
    });

    it("should revert with InsufficientLiquidity", async () => {
      const validPeriod = daysToSeconds(30);
      await products.addAsset(AddressZero, true);
      const limitedLiquidityAssetId = 1;
      const smallLiquidity = toWei("0.5");
      await riskCoverHook.addLiquidity(limitedLiquidityAssetId, smallLiquidity);
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: limitedLiquidityAssetId,
        amount: toWei("1"),
        period: validPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: toWei("1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "InsufficientLiquidity");
    });

    it("should revert with PremiumPaymentFailed", async () => {
      const validPeriod = daysToSeconds(30);
      const coverAmount = toWei("1");
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: coverAmount,
        period: validPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(coverAmount, validPeriod, 0);
      const insufficientPremium = premium - 1n;
      
      await expect(riskCoverHook.buyCover(buyCoverParams, { value: insufficientPremium }))
        .to.be.revertedWithCustomError(riskCoverHook, "PremiumPaymentFailed");
    });

    it("should successfully buy cover with eth and check cover info", async () => {
      const validPeriod = daysToSeconds(30);
      const coverAmount = toWei("1");
      
      const buyCoverParams = {
        coverId: 0,
        owner: addr1.address,
        productId: 0,
        coverAsset: 0,
        amount: coverAmount,
        period: validPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(coverAmount, validPeriod, 0);
      
      const totalCoverBefore = await riskCoverHook.getTotalActiveCover(0);
      
      await riskCoverHook.connect(addr1).buyCover(buyCoverParams, { value: premium });
      
      const coverId = 1;
      const coverInfo = await riskCoverHook.getCover(coverId);
      expect(coverInfo.owner).to.equal(addr1.address);
      expect(coverInfo.productId).to.equal(0);
      expect(coverInfo.coverAsset).to.equal(0);
      expect(coverInfo.amount).to.equal(coverAmount);
      expect(coverInfo.period).to.equal(validPeriod);
      expect(coverInfo.active).to.be.true;
      const userCovers = await riskCoverHook.getUserCovers(addr1.address);
      expect(userCovers.length).to.equal(1);
      expect(userCovers[0]).to.equal(coverId);
      const totalCoverAfter = await riskCoverHook.getTotalActiveCover(0);
      expect(totalCoverAfter).to.equal(totalCoverBefore + coverAmount);
    });

    it("should successfully mint NFT to user when buying cover", async () => {
      const validPeriod = daysToSeconds(30);
      const coverAmount = toWei("0.5");
      
      const buyCoverParams = {
        coverId: 0,
        owner: addr2.address,
        productId: 0,
        coverAsset: 0,
        amount: coverAmount,
        period: validPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(coverAmount, validPeriod, 0);
      
      const contractBalanceBefore = await ethers.provider.getBalance(riskCoverHook.target);
      await riskCoverHook.connect(addr2).buyCover(buyCoverParams, { value: premium });
      
      const coverId = 1;
      const tokenOwner = await coverNFT.ownerOf(coverId);
      expect(tokenOwner).to.equal(addr2.address);
      const contractBalanceAfter = await ethers.provider.getBalance(riskCoverHook.target);
      expect(contractBalanceAfter).to.equal(contractBalanceBefore + premium);
    });
  });

  describe("extendCover", () => {
    let products;
    let coverNFT;
    let riskCoverHook;
    let coverId;
    let initialCoverAmount;
    let initialPeriod;

    beforeEach(async () => {
      const deployment = await loadFixture(deployRiskCoverHook);
      products = deployment.products;
      coverNFT = deployment.coverNFT;
      riskCoverHook = deployment.riskCoverHook;

      initialCoverAmount = toWei("1");
      initialPeriod = daysToSeconds(30);

      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: initialCoverAmount,
        period: initialPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(initialCoverAmount, initialPeriod, 0);
      await riskCoverHook.buyCover(buyCoverParams, { value: premium });
      
      coverId = 1;
    });

    it("should revert with CoverNotFound", async () => {
      const invalidCoverId = 999;
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: invalidCoverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: extendPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: toWei("0.1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "CoverNotFound");
    });

    it("should revert with NotCoverOwner", async () => {
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: extendPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.connect(addr1).buyCover(extendCoverParams, { value: toWei("0.1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "NotCoverOwner");
    });

    it("should revert with AssetNotSupported", async () => {
      await products.addAsset(AddressZero, true);
      const differentAssetId = 1;
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: differentAssetId,
        amount: 0,
        period: extendPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: toWei("0.1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "AssetNotSupported");
    });

    it("should revert with NoModificationsRequested", async () => {
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: 0,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: toWei("0.1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "NoModificationsRequested");
    });

    it("should revert with CoverPeriodTooLong", async () => {
      const MAX_COVER_PERIOD = daysToSeconds(365);
      const tooLongExtendPeriod = MAX_COVER_PERIOD - initialPeriod + 1;
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: tooLongExtendPeriod,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: toWei("1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "CoverPeriodTooLong");
    });

    it("should revert with InsufficientLiquidity", async () => {
      await products.addAsset(AddressZero, true);
      const limitedLiquidityAssetId = 1;
      await riskCoverHook.addLiquidity(limitedLiquidityAssetId, toWei("0.5"));
      
      const buyCoverParams = {
        coverId: 0,
        owner: owner.address,
        productId: 0,
        coverAsset: limitedLiquidityAssetId,
        amount: toWei("0.3"),
        period: initialPeriod,
        paymentAsset: 0
      };

      const premium1 = await products.calculatePremium(toWei("0.3"), initialPeriod, 0);
      await riskCoverHook.buyCover(buyCoverParams, { value: premium1 });
      
      const secondCoverId = 2;
      
      const extendCoverParams = {
        coverId: secondCoverId,
        owner: owner.address,
        productId: 0,
        coverAsset: limitedLiquidityAssetId,
        amount: toWei("0.3"),
        period: 0,
        paymentAsset: 0
      };
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: toWei("0.1") }))
        .to.be.revertedWithCustomError(riskCoverHook, "InsufficientLiquidity");
    });

    it("should revert with PremiumPaymentFailed", async () => {
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: extendPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(initialCoverAmount, extendPeriod, 0);
      const insufficientPremium = premium - 1n;
      
      await expect(riskCoverHook.buyCover(extendCoverParams, { value: insufficientPremium }))
        .to.be.revertedWithCustomError(riskCoverHook, "PremiumPaymentFailed");
    });

    it("should successfully extend cover period", async () => {
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: 0,
        period: extendPeriod,
        paymentAsset: 0
      };

      const premium = await products.calculatePremium(initialCoverAmount, extendPeriod, 0);
      const coverBefore = await riskCoverHook.getCover(coverId);
      const contractBalanceBefore = await ethers.provider.getBalance(riskCoverHook.target);
      
      await riskCoverHook.buyCover(extendCoverParams, { value: premium });
      
      const coverAfter = await riskCoverHook.getCover(coverId);
      const contractBalanceAfter = await ethers.provider.getBalance(riskCoverHook.target);
      
      const expectedPeriod = toBN(coverBefore.period).plus(toBN(extendPeriod));
      expect(toBN(coverAfter.period).toString()).to.equal(expectedPeriod.toString());
      
      expect(toBN(coverAfter.amount).toString()).to.equal(toBN(coverBefore.amount).toString());
      
      const expectedBalance = toBN(contractBalanceBefore).plus(toBN(premium));
      expect(toBN(contractBalanceAfter).toString()).to.equal(expectedBalance.toString());
    });

    it("should successfully increase cover amount", async () => {
      const additionalAmount = toWei("0.5");
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: additionalAmount,
        period: 0,
        paymentAsset: 0
      };

      const remainingPeriod = initialPeriod;
      const premium = await products.calculatePremium(additionalAmount, remainingPeriod, 0);
      const coverBefore = await riskCoverHook.getCover(coverId);
      const totalCoverBefore = await riskCoverHook.getTotalActiveCover(0);
      const contractBalanceBefore = await ethers.provider.getBalance(riskCoverHook.target);
      
      await riskCoverHook.buyCover(extendCoverParams, { value: premium });
      
      const coverAfter = await riskCoverHook.getCover(coverId);
      const totalCoverAfter = await riskCoverHook.getTotalActiveCover(0);
      const contractBalanceAfter = await ethers.provider.getBalance(riskCoverHook.target);
      
      const expectedAmount = toBN(coverBefore.amount).plus(toBN(additionalAmount));
      expect(toBN(coverAfter.amount).toString()).to.equal(expectedAmount.toString());
      expect(coverAfter.period).to.equal(coverBefore.period);
      
      const expectedTotalCover = toBN(totalCoverBefore).plus(toBN(additionalAmount));
      expect(toBN(totalCoverAfter).toString()).to.equal(expectedTotalCover.toString());
      
      const expectedBalance = toBN(contractBalanceBefore).plus(toBN(premium));
      expect(toBN(contractBalanceAfter).toNumber()).to.be.closeTo(
        toBN(expectedBalance).toNumber(),
        0.0001 * toBN(expectedBalance).toNumber() // 0.01% tolerance
      );
    });

    it("should successfully increase both amount and period", async () => {
      const additionalAmount = toWei("0.5");
      const extendPeriod = daysToSeconds(30);
      
      const extendCoverParams = {
        coverId: coverId,
        owner: owner.address,
        productId: 0,
        coverAsset: 0,
        amount: additionalAmount,
        period: extendPeriod,
        paymentAsset: 0
      };

      const coverBefore = await riskCoverHook.getCover(coverId);
      const totalCoverBefore = await riskCoverHook.getTotalActiveCover(0);
      const contractBalanceBefore = await ethers.provider.getBalance(riskCoverHook.target);
      const remainingPeriod = initialPeriod;
      
      const premium1 = await products.calculatePremium(additionalAmount, remainingPeriod, 0);
      const combinedAmount = toBN(initialCoverAmount).plus(toBN(additionalAmount));
      const premium2 = await products.calculatePremium(combinedAmount.toString(), extendPeriod, 0);
      
      const totalPremium = toBN(premium1).plus(toBN(premium2)).toString();
      
      await riskCoverHook.buyCover(extendCoverParams, { value: totalPremium });
      
      const coverAfter = await riskCoverHook.getCover(coverId);
      const totalCoverAfter = await riskCoverHook.getTotalActiveCover(0);
      const contractBalanceAfter = await ethers.provider.getBalance(riskCoverHook.target);
      
      // Use BigNumber for safe arithmetic in assertions
      const expectedAmount = toBN(coverBefore.amount).plus(toBN(additionalAmount));
      expect(toBN(coverAfter.amount).toString()).to.equal(expectedAmount.toString());
      
      const expectedPeriod = toBN(coverBefore.period).plus(toBN(extendPeriod));
      expect(toBN(coverAfter.period).toString()).to.equal(expectedPeriod.toString());
      
      const expectedTotalCover = toBN(totalCoverBefore).plus(toBN(additionalAmount));
      expect(toBN(totalCoverAfter).toString()).to.equal(expectedTotalCover.toString());
      
      const expectedBalance = toBN(contractBalanceBefore).plus(toBN(totalPremium));
      expect(toBN(contractBalanceAfter).toNumber()).to.be.closeTo(
        toBN(expectedBalance).toNumber(),
        0.0001 * toBN(expectedBalance).toNumber() // 0.01% tolerance
      );
    });
  });
});
