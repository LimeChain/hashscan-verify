
import { task } from "hardhat/config";

// This script uses the wrapper task. Run via package.json script or:
// npx hardhat hashscan-verify --network hedera_testnet --address <ADDR> --contract contracts/Counter.sol:Counter
task("verify-counter", "Verify a deployed Counter contract").setAction(async (_, hre) => {
  const address = process.env.ADDRESS;
  if (!address) throw new Error("Set ADDRESS env var to the deployed contract address.");
  await hre.run("hashscan-verify", {
    address,
    contract: "contracts/Counter.sol:Counter",
  });
});
