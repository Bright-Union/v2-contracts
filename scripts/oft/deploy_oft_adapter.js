const hre = require("hardhat");
const { LAYERZERO_ENDPOINT, LAYERZERO_ENDPOINT_ID, BRIGHT_OFT } = require('../addresses_lookup')
const { ethers } = require('hardhat')

async function main() {
  const [deployer] = await ethers.getSigners();

  const l2OFTAdapter = await hre.ethers.deployContract("BrightOFTAdapter",
    [
      LAYERZERO_ENDPOINT[hre.network.name],
      deployer.address
    ]);
  await l2OFTAdapter.waitForDeployment();
  console.log(
    `BrightOFTAdapter was deployed to ${await l2OFTAdapter.getAddress()}`
  );

  //gnosis link
  await l2OFTAdapter.setPeer(LAYERZERO_ENDPOINT_ID.gnosis,
    ethers.zeroPadValue(BRIGHT_OFT.gnosis, 32));
  //base link
  await l2OFTAdapter.setPeer(LAYERZERO_ENDPOINT_ID.base,
    ethers.zeroPadValue(BRIGHT_OFT.base, 32));

  await l2OFTAdapter.setDelegate(process.env.OWNER_ADDRESS);
  await l2OFTAdapter.transferOwnership(process.env.OWNER_ADDRESS);
  console.log(`Ownership transferred to ${process.env.OWNER_ADDRESS}`);


  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await l2OFTAdapter.getAddress(),
      constructorArguments: [
        LAYERZERO_ENDPOINT[hre.network.name],
        deployer.address
      ],
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
