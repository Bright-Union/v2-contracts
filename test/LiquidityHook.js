const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  toWei,
  toBN,
  daysToSeconds,
  increaseTime,
  getCurrentBlockTimestamp,
} = require("../helpers/utils");

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

      const currentEpoch =
        Math.floor((await getCurrentBlockTimestamp()) / (24 * 60 * 60)) + 1;
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

      const [accPremium, lastPremiumAmount, lastPremiumEpoch] =
        await liquidityHook.getPremiumDistributionInfo(0);
      expect(toBN(accPremium).toNumber()).to.equal(0);

      expect(toBN(lastPremiumAmount).toString()).to.equal("0");
      expect(toBN(lastPremiumEpoch).toString()).to.equal(
        (currentEpoch - 1).toString()
      );

      const startDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch
      );
      const endDelta = await liquidityHook.getPremiumDistributionDelta(
        0,
        currentEpoch + distributionEpochs
      );

      const dailyPremiumAmount = toBN(premiumAmount)
        .times(1e18)
        .idiv(toBN(distributionEpochs));

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

      const currentEpoch =
        Math.floor((await getCurrentBlockTimestamp()) / (24 * 60 * 60)) + 1;
      const distributionEpochs = Math.max(
        1,
        Math.floor(period / (24 * 60 * 60))
      );

      await liquidityHook.addPremiumToDistribution(0, premiumAmount, period, {
        value: premiumAmount,
      });

      const [accPremium, lastPremiumAmount, lastPremiumEpoch] =
        await liquidityHook.getPremiumDistributionInfo(0);
      expect(toBN(accPremium).toNumber()).to.equal(0);
      expect(toBN(lastPremiumAmount).toNumber()).to.equal(0);

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

      await liquidityHook.addPremiumToDistribution(
        0,
        premiumAmount,
        daysToSeconds(30),
        { value: premiumAmount }
      );

      await increaseTime(daysToSeconds(1));

      const contractBalanceBefore = await ethers.provider.getBalance(
        liquidityHook.target
      );
      const userBalanceBefore = await ethers.provider.getBalance(owner.address);

      await liquidityHook.claimRewards(0);

      const userBalanceAfter = await ethers.provider.getBalance(owner.address);

      const contractBalanceAfter = await ethers.provider.getBalance(
        liquidityHook.target
      );

      const oneDayPremium = toBN(premiumAmount).idiv(toBN(30));

      expect(toBN(userBalanceAfter).toNumber()).to.be.closeTo(
        toBN(userBalanceBefore).plus(oneDayPremium).toNumber(),
        toBN(toWei(".001")).toNumber() // tolerance for gas costs
      );

      expect(toBN(contractBalanceAfter).toString()).to.equal(
        toBN(contractBalanceBefore).minus(oneDayPremium).toString()
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

      await increaseTime(daysToSeconds(1));

      const oneDayPremium = toBN(premiumAmount).idiv(toBN(30));

      const oneDayPremiumStr = oneDayPremium.toString();

      await expect(liquidityHook.claimRewards(0))
        .to.emit(liquidityHook, "RewardsClaimed")
        .withArgs(owner.address, 0, oneDayPremiumStr);
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

      await increaseTime(daysToSeconds(1));

      const oneDayPremium = toBN(premiumAmount).idiv(toBN(30));

      const pendingRewards = await liquidityHook.getPendingRewards(
        0,
        owner.address
      );
      expect(toBN(pendingRewards).toString()).to.equal(
        oneDayPremium.toString()
      );
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
      console.log("time", await getCurrentBlockTimestamp());
      // Fast forward time
      await increaseTime(daysToSeconds(15));
      console.log("time", await getCurrentBlockTimestamp());

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
      expect(toBN(ownerRewards).toNumber()).to.be.closeTo(
        toBN(toWei("0.25")).toNumber(),
        1
      );

      // Users should each get ~25% of rewards
      expect(toBN(user1Rewards).toNumber()).to.be.closeTo(
        toBN(toWei("0.125")).toNumber(),
        1
      );
      expect(toBN(user2Rewards).toNumber()).to.be.closeTo(
        toBN(toWei("0.125")).toNumber(),
        1
      );
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

  describe("leveraged liquidity", function () {
    it("should track product capacity and utilization based on allocations", async function () {
      const { products, liquidityHook, owner } = await loadFixture(deployContracts);
      
      const liquidityAmount = toWei("100");
      await liquidityHook.addLiquidity(0, liquidityAmount, { value: liquidityAmount });
      
      const product1 = ["Product1", 1, 1, "ipfs://product1.json", 100, 1, false];
      const product2 = ["Product2", 2, 2, "ipfs://product2.json", 200, 1, false];
      
      // Asset ID 0 (ETH) allocation: Product1 = 30%, Product2 = 70%
      await products.setProducts(
        [product1, product2],
        [[0], [0]],  // assetIds for each product
        [[30], [70]]  // allocations for each product
      );
      
      // Verify allocations were set correctly
      expect(await products.getProductAllocation(0, 0)).to.equal(30);
      expect(await products.getProductAllocation(1, 0)).to.equal(70);
      expect(await products.getTotalAssetAllocations(0)).to.equal(100);
      
      // Check capacity calculation (liquidity * LEVERAGE_MULTIPLIER * allocation / totalAllocations)
      // LEVERAGE_MULTIPLIER = 25 from the contract
      const totalLeveraged = toBN(liquidityAmount).times(25);
      
      // Product 1 should have 30% capacity
      const expectedCapacity1 = totalLeveraged.times(30).div(100);
      const actualCapacity1 = await liquidityHook.getProductCapacity(0, 0);
      expect(toBN(actualCapacity1).toString()).to.equal(expectedCapacity1.toString());
      
      // Product 2 should have 70% capacity
      const expectedCapacity2 = totalLeveraged.times(70).div(100);
      const actualCapacity2 = await liquidityHook.getProductCapacity(0, 1);
      expect(toBN(actualCapacity2).toString()).to.equal(expectedCapacity2.toString());
      
      // Available capacity should equal capacity when no utilization
      expect(await liquidityHook.getAvailableProductCapacity(0, 0)).to.equal(actualCapacity1);
      expect(await liquidityHook.getAvailableProductCapacity(0, 1)).to.equal(actualCapacity2);
    });
    
    it("should track product utilization when purchasing cover", async function () {
      const { products, liquidityHook, owner } = await loadFixture(deployContracts);
      
      // Add some liquidity to the pool
      const liquidityAmount = toWei("100");
      await liquidityHook.addLiquidity(0, liquidityAmount, { value: liquidityAmount });
      
      // Create two products with different allocations
      const product1 = ["Product1", 1, 1, "ipfs://product1.json", 100, 1, false];
      const product2 = ["Product2", 2, 2, "ipfs://product2.json", 200, 1, false];
      
      // Asset ID 0 (ETH) allocation: Product1 = 30%, Product2 = 70%
      await products.setProducts(
        [product1, product2],
        [[0], [0]],
        [[30], [70]]
      );
      
      // Simulate buying cover for Product 1 (use half of its capacity)
      const coverAmount1 = toBN(await liquidityHook.getProductCapacity(0, 0)).div(2);
      await liquidityHook.purchaseCover(0, 0, coverAmount1.toString());
      
      // Check utilization is tracked correctly
      expect(await liquidityHook.getProductUtilization(0, 0)).to.equal(coverAmount1.toString());
      
      // Available capacity should be reduced by utilization
      const capacity1 = await liquidityHook.getProductCapacity(0, 0);
      const availableCapacity1 = await liquidityHook.getAvailableProductCapacity(0, 0);
      expect(toBN(capacity1).minus(coverAmount1).toString()).to.equal(toBN(availableCapacity1).toString());
      
      // Product 2 should still have full capacity
      const capacity2 = await liquidityHook.getProductCapacity(0, 1);
      const availableCapacity2 = await liquidityHook.getAvailableProductCapacity(0, 1);
      expect(capacity2).to.equal(availableCapacity2);
    });
    
    it("should revert when product has insufficient capacity", async function () {
      const { products, liquidityHook, owner } = await loadFixture(deployContracts);
      
      // Add some liquidity to the pool
      const liquidityAmount = toWei("100");
      await liquidityHook.addLiquidity(0, liquidityAmount, { value: liquidityAmount });
      
      // Create product with allocation
      const product1 = ["Product1", 1, 1, "ipfs://product1.json", 100, 1, false];
      
      await products.setProducts(
        [product1],
        [[0]],
        [[100]]
      );
      
      // Get product capacity
      const capacity = await liquidityHook.getProductCapacity(0, 0);
      
      // Try to buy cover with amount exceeding capacity
      const excessAmount = toBN(capacity).plus(1).toString();
      await expect(
        liquidityHook.purchaseCover(0, 0, excessAmount)
      ).to.be.revertedWithCustomError(liquidityHook, "InsufficientProductCapacity");
    });
    
    it("should update utilization when cover expires", async function () {
      const { products, liquidityHook, owner } = await loadFixture(deployContracts);
      
      // Add some liquidity to the pool
      const liquidityAmount = toWei("100");
      await liquidityHook.addLiquidity(0, liquidityAmount, { value: liquidityAmount });
      
      // Create product with allocation
      const product1 = ["Product1", 1, 1, "ipfs://product1.json", 100, 1, false];
      
      await products.setProducts(
        [product1],
        [[0]],
        [[100]]
      );
      
      // Simulate buying cover
      const coverAmount = toWei("10");
      await liquidityHook.purchaseCover(0, 0, coverAmount);
      
      // Check utilization
      expect(await liquidityHook.getProductUtilization(0, 0)).to.equal(coverAmount);
      
      // Simulate cover expiration
      await liquidityHook.expireCover(0, 0, coverAmount);
      
      // Check utilization is reset
      expect(await liquidityHook.getProductUtilization(0, 0)).to.equal(0);
      
      // Available capacity should be back to full
      const capacity = await liquidityHook.getProductCapacity(0, 0);
      const availableCapacity = await liquidityHook.getAvailableProductCapacity(0, 0);
      expect(capacity).to.equal(availableCapacity);
    });
  });
});
