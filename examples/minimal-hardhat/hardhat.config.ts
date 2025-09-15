
import "@nomicfoundation/hardhat-verify";
import "@nomicfoundation/hardhat-ethers";
import hardhatHashscanVerify from "hardhat-hashscan-verify";

export default {
  solidity: "0.8.24",
  plugins: [hardhatHashscanVerify],
  networks: {
    hedera_testnet: {
      type: "http",
      url: "https://testnet.hashio.io/api",
      accounts: ["0xb46751179bc8aa9e129d34463e46cd924055112eb30b31637b5081b56ad96129"]
    },
    // hedera_mainnet: { url: "https://mainnet.hashio.io/api", chainId: 295 },
    // hedera_previewnet: { url: "https://previewnet.hashio.io/api", chainId: 297 },
  },
} as const;
