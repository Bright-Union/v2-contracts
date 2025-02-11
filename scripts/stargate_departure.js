const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const stargateBusDeparture = await hre.ethers.deployContract("StargateBusDeparture", [])
  await stargateBusDeparture.waitForDeployment();
  console.log(
    `StargateBusDeparture was deployed to ${await stargateBusDeparture.getAddress()}`
  );



  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await stargateBusDeparture.getAddress()
    });
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
