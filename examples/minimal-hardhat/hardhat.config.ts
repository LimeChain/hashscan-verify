
import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "hardhat-hashscan-verify";

export default defineConfig({
  solidity: "0.8.24",
  networks: {
    hedera_testnet: { url: "https://testnet.hashio.io/api", chainId: 296 },
    // hedera_mainnet: { url: "https://mainnet.hashio.io/api", chainId: 295 },
    // hedera_previewnet: { url: "https://previewnet.hashio.io/api", chainId: 297 },
  },
});
