const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { toWei, getCurrentBlockTimestamp, toBN, getTransactionBlock, advanceBlocks, daysToSeconds } = require('../helpers/utils')
const { ethers, upgrades } = require('hardhat');

const { AddressZero } = require("@ethersproject/constants");

describe("Products", function () {

  let owner;
  let addr1;
  let addr2;
  let addr3;

  const product = ['Aave', 0, 0, 'ipfs://aave.json',
    100, /* 1% */
    1,
    false];

  before("Setup", async() => {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
  });

  async function deployProducts() {
    return await ethers.deployContract("Products", [owner]);
  }

  describe("set functions", () => {

    let products;

    it("should set products", async () => {
      products  = await loadFixture(deployProducts);
      expect(await products.owner()).to.equal(owner);

      await products.setProducts([product], [[]], [[]]);  // Updated to include assetIds and allocations params

      expect(await products.getProductCount()).to.equal(1);
      expect((await products.getProduct(0))[0]).to.equal('Aave');
      expect(await products.getProductName(0)).to.equal('Aave');
    });
  });

  describe("premiums", () => {
    let products;

    it("should calculate premium", async () => {
      products = await loadFixture(deployProducts);
      await products.setProducts([product], [[]], [[]]);

      const amount = toWei('1');
      const duration = daysToSeconds(365);
      console.log(await products.calculatePremium(amount, duration, 0));
    });
  });



})
