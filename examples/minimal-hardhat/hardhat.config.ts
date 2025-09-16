
import "@nomicfoundation/hardhat-ethers";
import hashscanVerify from "hashscan-verify";

export default {
  solidity: "0.8.24",
  plugins: [hashscanVerify],
  networks: {
    testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      accounts: [
        "0xYOUR_PRIVATE_KEY",
      ],
    },
    // mainnet: { url: "https://mainnet.hashio.io/api" },
    // previewnet: { url: "https://previewnet.hashio.io/api" },
    // local: { url: "http://localhost:7546" },
  },
} as const;
