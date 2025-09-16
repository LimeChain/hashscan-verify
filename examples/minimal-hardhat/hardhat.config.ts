
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
    // Legacy network names are also supported for backward compatibility
    hedera_testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      accounts: [
        "0xYOUR_PRIVATE_KEY",
      ],
    },
    // mainnet: { url: "https://mainnet.hashio.io/api" },
    // previewnet: { url: "https://previewnet.hashio.io/api" },
    local: { type: "http", url: "http://localhost:7546", accounts: [
      "0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129",
    ] },
  },
} as const;
