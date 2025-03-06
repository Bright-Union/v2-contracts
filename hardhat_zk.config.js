require ("hardhat/config");
require ("@matterlabs/hardhat-zksync");
require('dotenv').config()

module.exports = {
  zksolc: {
    version: "latest",
    settings: {
      // Note: This must be true to call NonceHolder & ContractDeployer system contracts
      enableEraVMExtensions: false,
    },
  },
  networks: {
    abstract: {
      url: "https://api.mainnet.abs.xyz",
      ethNetwork: "mainnet",
      zksync: true,
      chainId: 2741,
    },
  },
  etherscan: {
    apiKey: {
      abstract: process.env.ABSCAN_API_KEY,
    },
    customChains: [
      {
        network: "abstract",
        chainId: 2741,
        urls: {
          apiURL: "https://api.abscan.org/api",
          browserURL: "https://abscan.org/",
        },
      },
    ],
  },
  solidity: {
    version: "0.8.24",
  },
}
