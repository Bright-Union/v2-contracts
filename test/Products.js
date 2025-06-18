const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { toWei, getCurrentBlockTimestamp, toBN, getTransactionBlock, advanceBlocks} = require('../helpers/utils')
const { ethers, upgrades } = require('hardhat');

const { AddressZero } = require("@ethersproject/constants");

describe("Products", function () {

  let owner;
  let addr1;
  let addr2;
  let addr3;

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

      const product = ['Aave', 0, 0, 'ipfs://aave.json', 10, 1, false];
      await products.setProducts([product]);

      expect(await products.getProductCount()).to.equal(1);
      expect((await products.getProduct(0))[0]).to.equal('Aave');
      expect(await products.getProductName(0)).to.equal('Aave');

    });
  });



})
