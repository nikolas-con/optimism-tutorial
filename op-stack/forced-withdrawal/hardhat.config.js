require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require('dotenv').config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
//   const accounts = await hre.ethers.getSigners();

//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
// CHAIN_ID=10 npx hardhat node --fork https://opt-mainnet.g.alchemy.com/v2/PaFBIwnjn_Mb-f8tr9nZgI2rNZvTP2xo
module.exports = {
  solidity: "0.8.4",
  networks :{
    hardhat: {
      forking: {
        url: process.env.L1URL,
      },
      chainId: Number(process.env.CHAIN_ID ?? 1)
    },
    devnetL1: {
      live: false,
      url: 'http://localhost:8545',
      accounts: [
        'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ],
      chainId: 900
    },
    devnetL2: {
      live: false,
      url: process.env.RPC_URL || 'http://localhost:9545',
      accounts: [
        'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ],
      chainId: 901
    },
  },
  mocha: {
    timeout: 100000000
  },
};
