
import "@nomicfoundation/hardhat-ethers";
import hardhatHashscanVerify from "hardhat-hashscan-verify";

export default {
  solidity: "0.8.24",
  plugins: [hardhatHashscanVerify],
  networks: {
    testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      accounts: ["0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129"]
    },
    // Legacy network names are also supported for backward compatibility
    hedera_testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      accounts: ["0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129"]
    },
    // mainnet: { url: "https://mainnet.hashio.io/api" },
    // previewnet: { url: "https://previewnet.hashio.io/api" },
    // local: { url: "http://localhost:7546" },
  },
} as const;
