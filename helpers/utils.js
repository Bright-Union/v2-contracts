const BigNumber = require("bignumber.js");
const {
  time
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { takeSnapshot, mineUpTo } = require("@nomicfoundation/hardhat-network-helpers");

function toBN(number) {
  return new BigNumber(number);
}
const Web3 = require("web3");
const web3 = new Web3();
const { toWei, fromWei } = web3.utils;
const { BN } = web3.utils;

const daysToSeconds = days => days * 24 * 60 * 60;

let _snapshot;
async function snapshot() {
  _snapshot = await takeSnapshot();
}

async function restore() {
  await _snapshot.restore();
}

async function increaseTime(duration) {
  await time.increase(duration);
}

async function increaseTimeTo(target) {
  await time.increaseTo(target);
}

async function advanceBlocks(blockAmount) {
  const lastBlock = await time.latestBlock();
  await mineUpTo(lastBlock + blockAmount);
}

async function advanceBlockTo(target) {
  await mineUpTo(target);
}

const convert = (amount) => {
  const amountStbl = toBN(amount).div(toBN(10).pow(12));
  return amountStbl;
};

function getStableAmount(amount) {
  return toBN(toWei(amount, "mwei"));
}

async function getCurrentBlockTimestamp() {
  return (await web3.eth.getBlock("latest")).timestamp;
}

async function getPreviousBlockTimestamp() {
  const latest = toBN(await web3.eth.getBlockNumber());
  return (await web3.eth.getBlock(latest.minus(1))).timestamp;
}

async function getCurrentBlock() {
  const block = await web3.eth.getBlock("latest");
  return block.number;
}

const getTransactionBlock = (tx) => tx.blockNumber;

async function getAdvanceBlocks(amount) {
  for (let i = 0; i < amount; i++) {
    await advanceBlockAtTime(1);
  }
}

function toMWeiBN(value) {
  if (typeof value === "number") value = value.toString();
  return new BN(toWei(value, "mwei"));
}

function toWeiBN(value) {
  if (typeof value === "number") value = value.toString();
  return new BN(toWei(value));
}

function randomAddress() {
  return web3.utils.randomHex(20);
}

function setNetworkName(network) {
  let chainId = network.config.chainId;
  if (chainId == 80000) {
    network.name = "development";
  } else if (chainId == 80002) {
    network.name = "bsc_development";
  }
  if (chainId == 80003) {
    network.name = "polygon_development";
  }
}

module.exports = {
  setNetworkName,
  increaseTime,
  increaseTimeTo,
  advanceBlocks,
  advanceBlockTo,
  getStableAmount,
  convert,
  daysToSeconds,
  snapshot,
  restore,
  getCurrentBlockTimestamp,
  getPreviousBlockTimestamp,
  getCurrentBlock,
  getTransactionBlock,
  getAdvanceBlocks,
  randomAddress,
  toMWeiBN,
  toWeiBN,
  toWei,
  fromWei,
  toBN,
  BN,
};
