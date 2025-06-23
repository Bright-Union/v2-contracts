const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const stargateCoverDispatcher = await hre.ethers.deployContract("StargateCoverDispatcher", [])
  await stargateCoverDispatcher.waitForDeployment();
  console.log(
    `StargateCoverDispatcher was deployed to ${await stargateCoverDispatcher.getAddress()}`
  );


  //verify
  if (hre.network.name !== 'localhost') {
    console.log('Waiting before verification....')
    const delay = ms => new Promise(res => setTimeout(res, ms));
    await delay(45000);

    await hre.run("verify:verify", {
      address: await stargateCoverDispatcher.getAddress()
    });
  }

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
