const hre = require("hardhat");
const { Deployer } = require('@matterlabs/hardhat-zksync')
const { Wallet } = require('zksync-ethers')
require('dotenv').config()

async function main() {
  // Initialize the wallet using your private key.
  const wallet = new Wallet(process.env.MAINNET_PRIVATE_KEY);

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);
  // Load contract
  const artifact = await deployer.loadArtifact("StargateBusDeparture");

  const stargateBusDeparture = await deployer.deploy(artifact);

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
