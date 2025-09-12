
# hardhat-hashscan-verify

A tiny wrapper around `@nomicfoundation/hardhat-verify` that **preconfigures Sourcify** to point at **HashScan's** Hedera verifier and adds a convenience task `hashscan-verify` that prints the correct HashScan link.

- Works for **Hedera Mainnet (295), Testnet (296), Previewnet (297) and Local (298)**
- No API key needed (Sourcify-style verification)
- Leverages the official Hardhat Verify plugin under the hood

## Install

```bash
npm i -D hardhat-hashscan-verify @nomicfoundation/hardhat-verify
```

## Usage

In your `hardhat.config.ts`:

```ts
import { defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "hardhat-hashscan-verify";

export default defineConfig({
  networks: {
    hedera_mainnet:   { url: "https://mainnet.hashio.io/api",   chainId: 295 },
    hedera_testnet:   { url: "https://testnet.hashio.io/api",   chainId: 296 },
    hedera_previewnet:{ url: "https://previewnet.hashio.io/api",chainId: 297 },
    hedera_local:{ url: "http://localhost:7546", chainId: 298 },
  },
  // You can still override verify.sourcify here, but defaults are set for HashScan.
});
```

### Verify a contract

Use the stock verify task:

```bash
npx hardhat verify --network hedera_testnet 0xYourContractAddress   --contract contracts/MyContract.sol:MyContract
```

Or use the wrapper task (prints the HashScan URL):

```bash
npx hardhat hashscan-verify --network hedera_testnet   --address 0xYourContractAddress   --contract contracts/MyContract.sol:MyContract
```

### Notes

- Prefer the fully-qualified name (FQN) `contracts/File.sol:ContractName` to disambiguate.
- If you have constructor args, pass them positionally or via `--constructor-args path/to/args.js`.
- On Hedera Testnet/Previewnet, verifications are wiped on periodic resets—just re-run verify after redeploy.
- Foundry users: no wrapper needed. Use:
  ```bash
  forge verify-contract --chain-id 296     --verifier sourcify --verifier-url https://server-verify/hashscan.io     <ADDRESS> src/MyContract.sol:ContractName
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
