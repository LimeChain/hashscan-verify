
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import "hardhat/types/tasks";

// This script uses the wrapper task. Run via package.json script or:
// npx hardhat hashscan-verify --network hedera_testnet --address <ADDR> --contract contracts/Counter.sol:Counter
task("verify-counter", "Verify a deployed Counter contract").setAction(
  async () => ({
    default: async (_: any, hre: HardhatRuntimeEnvironment) => {
      const address = process.env.ADDRESS;
      if (!address) {
        throw new Error(
          "Set ADDRESS env var to the deployed contract address.",
        );
      }
      await hre.tasks.getTask("hashscan-verify").run({
        address,
        contract: "contracts/Counter.sol:Counter",
      });
    },
  }),
);
