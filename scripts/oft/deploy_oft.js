const hre = require("hardhat");
const { LAYERZERO_ENDPOINT } = require('../addresses_lookup')

async function main() {
  const [deployer] = await ethers.getSigners();

  const l2OFT = await hre.ethers.deployContract("BrightTokenOFT",
    [
      LAYERZERO_ENDPOINT[hre.network.name],
      deployer.address
    ]);
  await l2OFT.waitForDeployment();
  console.log(
    `BrightTokenOFT was deployed to ${await l2OFT.getAddress()}`
  );

  await l2OFT.setDelegate(process.env.OWNER_ADDRESS);
  await l2OFT.transferOwnership(process.env.OWNER_ADDRESS);
  console.log(`Ownership transferred to ${process.env.OWNER_ADDRESS}`);

  //NOTE: This OFT must be linked with other OFTs on the other chains

  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await l2OFT.getAddress(),
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
