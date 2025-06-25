const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  toWei,
  toBN,
  daysToSeconds,
  increaseTime,
} = require("../helpers/utils");

// Using .toNumber() directly on BigNumber objects for assertions

// daysToSeconds is now imported from utils.js

describe("LiquidityHook", function () {
  async function deployContracts() {
    const [owner, user1, user2] = await ethers.getSigners();

    const Products = await ethers.getContractFactory("Products");
    const products = await Products.deploy(owner.address);

    const LiquidityHookMock = await ethers.getContractFactory(
      "LiquidityHookMock"
    );
    const liquidityHook = await LiquidityHookMock.deploy(products.target);

    // Add ETH as an asset (asset ID 0)
    await products.addAsset(ethers.ZeroAddress, true);
    // Add DAI as an asset (asset ID 1)
    // Using a mock address for DAI (not a string literal)
    await products.addAsset("0x6B175474E89094C44Da98b954EedeAC495271d0F", true);

    return { products, liquidityHook, owner, user1, user2 };
  }

  describe("setup", function () {
    it("should deploy contracts", async function () {
      const { products, liquidityHook } = await loadFixture(deployContracts);
      expect(await liquidityHook.products()).to.equal(products.target);
    });
  });

  describe("premiumDistribution", function () {
    it("should add premium to distribution and verify deltas", async function () {
      const { liquidityHook } = await loadFixture(deployContracts);
      const liquidityAmount = toWei("1.0");
      const premiumAmount = toWei("0.1");
      const period = daysToSeconds(30);

      await liquidityHook.addLiquidity(0, liquidityAmount, {
        value: liquidityAmount,
      });

      // Get current time epoch for verification
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const currentEpoch = Math.floor(block.timestamp / (24 * 60 * 60)) + 1;
      const distributionEpochs = Math.max(
        1,
        Math.floor(period / (24 * 60 * 60))
      );

      await expect(
        liquidityHook.addPremiumToDistribution(0, premiumAmount, period, {
          value: premiumAmount,
        })
      )
        .to.emit(liquidityHook, "PremiumAdded")
        .withArgs(0, premiumAmount, period);

      // Check premium distribution info
      const [accPremium, lastPremiumAmount, lastPremiumEpoch] =
        await liquidityHook.getPremiumDistributionInfo(0);
      expect(toBN(accPremium).toNumber()).to.equal(0); // Premiums are not immediately distributed

      // With liquidity present, lastPremiumAmount should be equal to the premiumAmount
      expect(toBN(lastPremiumAmount).toString()).to.equal("0");

      // Check premium distribution deltas
      const startDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch
      );
      const endDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch + distributionEpochs
      );

      // Verify the daily premium amount
      const dailyPremiumAmount = toBN(premiumAmount).idiv(
        toBN(distributionEpochs)
      );

      // Verify the distribution deltas
      expect(toBN(startDelta).toString()).to.equal(
        dailyPremiumAmount.toString()
      );

      expect(toBN(endDelta).toString()).to.equal(
        toBN(dailyPremiumAmount).times(toBN(-1)).toString()
      );
    });

    it("should not distribute premium with no liquidity", async function () {
      const { liquidityHook } = await loadFixture(deployContracts);
      const premiumAmount = toWei("0.1");
      const period = daysToSeconds(30);

      // Get current time epoch for verification
      const blockNum = await ethers.provider.getBlockNumber();
      const block = await ethers.provider.getBlock(blockNum);
      const currentEpoch = Math.floor(block.timestamp / (24 * 60 * 60)) + 1;
      const distributionEpochs = Math.max(
        1,
        Math.floor(period / (24 * 60 * 60))
      );

      await liquidityHook.addPremiumToDistribution(0, premiumAmount, period, {
        value: premiumAmount,
      });

      // Check that distribution info is empty (no liquidity)
      const [accPremium, lastPremiumAmount, lastPremiumEpoch] =
        await liquidityHook.getPremiumDistributionInfo(0);
      expect(toBN(accPremium).toNumber()).to.equal(0);
      expect(toBN(lastPremiumAmount).toNumber()).to.equal(0);

      // Check that no deltas were created due to early return in _addPremiumToDistribution
      // when there's no liquidity
      const startDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch
      );
      const endDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch + distributionEpochs
      );

      expect(toBN(startDelta).toNumber()).to.equal(0);
      expect(toBN(endDelta).toNumber()).to.equal(0);
    });
  });

  describe("claimRewards", function () {
    it("should revert with InsufficientLiquidity", async function () {
      const { liquidityHook } = await loadFixture(deployContracts);

      await expect(liquidityHook.claimRewards(0)).to.be.revertedWithCustomError(
        liquidityHook,
        "InsufficientLiquidity"
      );
    });

    it("should successfully claim rewards", async function () {
      const { liquidityHook, owner } = await loadFixture(deployContracts);
      const liquidityAmount = toWei("1.0");
      const premiumAmount = toWei("0.1");

      await liquidityHook.addLiquidity(0, liquidityAmount, {
        value: liquidityAmount,
      });

      // Add premium directly as ETH
      await liquidityHook.addPremiumToDistribution(
        0,
        premiumAmount,
        daysToSeconds(30),
        { value: premiumAmount }
      );

      // Fast forward time to allow premiums to distribute
      await increaseTime(daysToSeconds(1));

      const balanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await liquidityHook.claimRewards(0);
      await tx.wait();

      const balanceAfter = await ethers.provider.getBalance(owner.address);

      // Using closeTo comparison to allow for gas costs
      expect(toBN(balanceAfter).toNumber()).to.be.closeTo(
        toBN(balanceBefore).plus(toBN(premiumAmount)).toNumber(),
        toBN(premiumAmount).times(toBN(0.01)).toNumber() // 1% tolerance for gas costs
      );
    });

    it("should emit RewardsClaimed event", async function () {
      const { liquidityHook, owner } = await loadFixture(deployContracts);
      const liquidityAmount = toWei("1.0");
      const premiumAmount = toWei("0.1");

      await liquidityHook.addLiquidity(0, liquidityAmount, {
        value: liquidityAmount,
      });

      await liquidityHook.addPremiumToDistribution(
        0,
        premiumAmount,
        daysToSeconds(30),
        { value: premiumAmount }
      );

      await ethers.provider.send("evm_increaseTime", [daysToSeconds(1)]);
      await ethers.provider.send("evm_mine");

      await expect(liquidityHook.claimRewards(0))
        .to.emit(liquidityHook, "RewardsClaimed")
        .withArgs(owner.address, 0, premiumAmount);
    });
  });

  describe("getPendingRewards", function () {
    it("should return 0 for user with no liquidity", async function () {
      const { liquidityHook, user1 } = await loadFixture(deployContracts);

      const pendingRewards = await liquidityHook.getPendingRewards(
        0,
        user1.address
      );
      expect(toBN(pendingRewards).toString()).to.equal("0");
    });

    it("should calculate pending rewards correctly", async function () {
      const { liquidityHook, owner } = await loadFixture(deployContracts);
      const liquidityAmount = toWei("1.0");
      const premiumAmount = toWei("0.1");

      await liquidityHook.addLiquidity(0, liquidityAmount, {
        value: liquidityAmount,
      });

      await liquidityHook.addPremiumToDistribution(
        0,
        premiumAmount,
        daysToSeconds(30),
        { value: premiumAmount }
      );

      await ethers.provider.send("evm_increaseTime", [daysToSeconds(1)]);
      await ethers.provider.send("evm_mine");

      const pendingRewards = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      expect(pendingRewards).to.be.closeTo(premiumAmount, toWei("0.001"));
    });
  });

  describe("multiple users", function () {
    it("should distribute rewards proportionally", async function () {
      const { liquidityHook, owner, user1, user2 } = await loadFixture(
        deployContracts
      );

      // Owner adds 1 ETH (50%)
      await liquidityHook.addLiquidity(0, toWei("1.0"), {
        value: toWei("1.0"),
      });

      // User1 adds 0.5 ETH (25%)
      await liquidityHook
        .connect(user1)
        .addLiquidity(0, toWei("0.5"), { value: toWei("0.5") });

      // User2 adds 0.5 ETH (25%)
      await liquidityHook
        .connect(user2)
        .addLiquidity(0, toWei("0.5"), { value: toWei("0.5") });

      // Add premium
      await liquidityHook.addPremiumToDistribution(
        0,
        toWei("1.0"),
        daysToSeconds(30),
        { value: toWei("1.0") }
      );

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [daysToSeconds(1)]);
      await ethers.provider.send("evm_mine");

      // Check pending rewards
      const ownerRewards = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      const user1Rewards = await liquidityHook.getPendingRewards(
        0,
        user1.address
      );
      const user2Rewards = await liquidityHook.getPendingRewards(
        0,
        user2.address
      );

      // Owner should get ~50% of rewards
      expect(ownerRewards).to.be.closeTo(toWei("0.5"), toWei("0.01"));

      // Users should each get ~25% of rewards
      expect(user1Rewards).to.be.closeTo(toWei("0.25"), toWei("0.01"));
      expect(user2Rewards).to.be.closeTo(toWei("0.25"), toWei("0.01"));
    });
  });

  describe("premium distribution over time", function () {
    it("should distribute premium over the specified period", async function () {
      const { liquidityHook, owner } = await loadFixture(deployContracts);
      const liquidityAmount = toWei("1.0");
      const premiumAmount = toWei("0.3");
      const period = daysToSeconds(30); // 30 days

      await liquidityHook.addLiquidity(0, liquidityAmount, {
        value: liquidityAmount,
      });

      // Add premium with 30 day distribution period
      await liquidityHook.addPremiumToDistribution(0, premiumAmount, period, {
        value: premiumAmount,
      });

      // After 1 day, should have ~1/30 of premiums
      await increaseTime(daysToSeconds(1));

      const pendingDay1 = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      // ~0.01 ETH (1/30 of 0.3)
      const expectedDay1 = toBN(premiumAmount).div(toBN(30));
      expect(toBN(pendingDay1).toString()).to.equal(expectedDay1.toString());

      // After 15 more days, should have ~16/30 of premiums
      await increaseTime(daysToSeconds(15));

      const pendingDay16 = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      // ~0.16 ETH (16/30 of 0.3)
      const expectedDay16 = toBN(premiumAmount).times(toBN(16)).div(toBN(30));
      expect(toBN(pendingDay16).toString()).to.equal(expectedDay16.toString());

      // After 14 more days (total 30), should have all premiums
      await increaseTime(daysToSeconds(14));

      const pendingDay30 = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      // Should have full premium amount
      expect(toBN(pendingDay30).toString()).to.equal(
        toBN(premiumAmount).toString()
      );
    });
  });
});
