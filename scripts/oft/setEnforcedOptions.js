const hre = require("hardhat");
const { Options, addressToBytes32 } = require('@layerzerolabs/lz-v2-utilities')
const { ethers } = require('ethers')



async function main() {

  const [deployer] = await hre.ethers.getSigners();
  /*const BrightOFTAdapter = await hre.ethers.getContractFactory("BrightOFTAdapter");
  const oftAdapter = BrightOFTAdapter.attach(
    "0x781b40005b308ff254e891f1a552271dd1ed12a6" // The deployed contract address
  );*/
  const BrightTokenOFT = await hre.ethers.getContractFactory("BrightTokenOFT");
  const l2OFT = BrightTokenOFT.attach(
    "0xb7e10110eedca190da51b22e90a2caee014c8140" // The deployed contract address
  );


  const eidB = '30184'; //base
  const eidC = '30101'; //mainnet

  let options = Options.newOptions().addExecutorLzReceiveOption(70000, 0).toBytes();

  await l2OFT.setEnforcedOptions([
    { eid: eidB, msgType: 1, options: options },
    { eid: eidB, msgType: 2, options: options },
    { eid: eidC, msgType: 1, options: options },
    { eid: eidC, msgType: 2, options: options },
  ]);

  // ownership
  console.log(
    `transferring ownership back`,
  );
  await l2OFT.setDelegate(process.env.OWNER_ADDRESS);
  await l2OFT.transferOwnership(process.env.OWNER_ADDRESS);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
