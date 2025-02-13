const hre = require("hardhat");
const { STARGATE_USDC_POOL, STARGATE_ENDPOINT } = require('./addresses_lookup')

async function main() {
  const [deployer] = await ethers.getSigners();

  //USDC
  const stargateBusArrivalNexusMutual = await hre.ethers.deployContract("StargateBusArrivalNexusMutual",
    [
      STARGATE_ENDPOINT[hre.network.name],
      '0x425b3a68f1fd5de26b4b9f4be8049e36406b187a'
    ]);
  await stargateBusArrivalNexusMutual.waitForDeployment();
  console.log(
    `StargateBusArrivalNexusMutual was deployed to ${await stargateBusArrivalNexusMutual.getAddress()}`
  );



  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await stargateBusArrivalNexusMutual.getAddress(),
      constructorArguments: [
        STARGATE_ENDPOINT[hre.network.name],
        '0x425b3a68f1fd5de26b4b9f4be8049e36406b187a'
      ],
    });
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
