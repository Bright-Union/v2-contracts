const hre = require("hardhat");
const { LAYERZERO_ENDPOINT } = require('./addresses_lookup')

async function main() {
  const [deployer] = await ethers.getSigners();

  const stargateCoverReceiver = await hre.ethers.deployContract("StargateCoverReceiver",
    [
      LAYERZERO_ENDPOINT[hre.network.name]
    ]);
  await stargateCoverReceiver.waitForDeployment();
  console.log(
    `StargateCoverReceiver was deployed to ${await stargateCoverReceiver.getAddress()}`
  );

  await stargateCoverReceiver.transferOwnership(process.env.OWNER_ADDRESS);
  console.log(`Ownership transferred to ${process.env.OWNER_ADDRESS}`);


  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await stargateCoverReceiver.getAddress(),
      constructorArguments: [
        LAYERZERO_ENDPOINT[hre.network.name]
      ],
    });
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
