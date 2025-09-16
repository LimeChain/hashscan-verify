
# hashscan-verify

[![npm version](https://badge.fury.io/js/hashscan-verify.svg)](https://badge.fury.io/js/hashscan-verify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)
![Hardhat](https://img.shields.io/badge/Hardhat-3.0+-green.svg)

A Hardhat plugin for verifying smart contracts on HashScan (Hedera's Sourcify-based contract verification service).

- Works for **Hedera Mainnet (295), Testnet (296), Previewnet (297) and Local (298)**
- No API key needed
- Direct integration with HashScan's Sourcify API
- Automatic contract verification status checking
- Clean error messages

## Install

```bash
npm i -D hashscan-verify
```

## Usage

In your `hardhat.config.ts`:

```ts
import { defineConfig } from "hardhat/config";
import hashscanVerify from "hashscan-verify";

export default defineConfig({
  plugins: [hashscanVerify],
  networks: {
    mainnet:     { url: "https://mainnet.hashio.io/api" },
    testnet:     { url: "https://testnet.hashio.io/api" },
    previewnet:  { url: "https://previewnet.hashio.io/api" },
    local:       { url: "http://localhost:7546" },
  },
});
```

Note: The plugin automatically sets the correct chain IDs for Hedera networks.

### Verify a contract

```bash
npx hardhat hashscan-verify 0xYourContractAddress --contract contracts/MyContract.sol:MyContract --network testnet
```

## Features

### Automatic Verification Status Check
The plugin checks if your contract is already verified before attempting verification:

```bash
$ npx hardhat hashscan-verify 0x... --contract contracts/Counter.sol:Counter --network testnet
Contract is already verified with perfect match.

View on HashScan: https://hashscan.io/testnet/contract/0x...
```

### Clean Error Messages
Meaningful error handling with helpful suggestions:

- Invalid contract address format
- Contract not found in artifacts
- Missing build info (suggests recompilation)
- Network connection issues

### Network Support
Supports both legacy `hedera_*` and simplified network names:
- `mainnet` or `hedera_mainnet` (Chain ID: 295)
- `testnet` or `hedera_testnet` (Chain ID: 296)  
- `previewnet` or `hedera_previewnet` (Chain ID: 297)
- `local` or `hedera_local` (Chain ID: 298)

### Environment Variables
- `HASHSCAN_API_URL` or `SOURCIFY_API_URL` - Override the API endpoint (defaults to HashScan's Sourcify)

## Examples

### Basic Verification
```bash
npx hardhat hashscan-verify 0x7A0505Eb4af57Eefb9B69619DB3bfc26348DE73A --contract contracts/Counter.sol:Counter --network testnet
```

### With Constructor Arguments
```bash
npx hardhat hashscan-verify 0x... --contract contracts/Token.sol:MyToken "My Token" "MTK" 1000000 --network mainnet
```

## Notes

- On Hedera Testnet/Previewnet, verifications are wiped on periodic resets—just re-run verify after redeploy
- Foundry users: no wrapper needed. Use forge directly with HashScan's Sourcify:
  ```bash
  forge verify-contract --chain-id 296 \
    --verifier sourcify \
    --verifier-url https://server-verify.hashscan.io \
    <ADDRESS> src/MyContract.sol:ContractName
  ```

## Development

Build the plugin:

```bash
npm run build
```

Publish (after build):

```bash
npm publish
```

## License

MIT
