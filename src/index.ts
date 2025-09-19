import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { HardhatPlugin } from "hardhat/types/plugins";
import type {
  HardhatUserConfig,
  HardhatConfig,
  ConfigurationVariableResolver,
} from "hardhat/types/config";
import "hardhat/types/tasks";

import { NetworkConfig, HEDERA_NETWORKS } from "./config/networks.js";
import { SourcifyService } from "./services/sourcify-service.js";
import { ValidationService } from "./services/validation-service.js";
import { ArtifactResolver } from "./services/artifact-resolver.js";

const hashscanVerifyTask = task(
  "hashscan-verify",
  "Verify contract on HashScan/Sourcify",
)
  .addPositionalArgument({
    name: "address",
    description: "Deployed contract address",
  })
  .addOption({
    name: "contract",
    description:
      "Fully qualified contract name (e.g., contracts/Counter.sol:Counter)",
    defaultValue: "",
  })
  .addVariadicArgument({
    name: "constructorArgs",
    description: "Constructor arguments (if any)",
    defaultValue: [],
  })
  .setAction(async () => ({
    default: async (
      args: { address: string; contract: string; constructorArgs?: string[] },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const { address, contract, constructorArgs = [] } = args;
      
      // Validation
      const validator = new ValidationService();
      const validationError = validator.validateInput(address, contract);
      if (validationError) {
        console.error(validationError);
        return;
      }

      const { contractPath, contractName } = validator.parseContract(contract);

      // Get network configuration
      const connection = await (hre as any).network?.connect();
      const chainId = connection?.networkConfig?.chainId;

      if (!chainId) {
        console.error(
          "Error: Could not determine chain ID. Make sure you're using the --network flag.",
        );
        return;
      }

      const networkConfig = NetworkConfig.fromChainId(chainId);
      const apiUrl = (hre.config as any).sourcify?.apiUrl || networkConfig.defaultApiUrl;

      // Initialize services
      const sourcifyService = new SourcifyService(apiUrl);
      const artifactResolver = new ArtifactResolver(hre);

      // Check if already verified
      const isVerified = await sourcifyService.checkIfVerified(
        address,
        chainId.toString(),
      );

      if (isVerified.status) {
        console.log(
          `Contract is already verified with ${isVerified.status} match.`,
        );
      } else {
        console.log(`Verifying ${contractName} at ${address}...`);

        try {
          // Resolve artifact and build info
          const { artifact, buildInfo, sourcePaths } = await artifactResolver.resolve(
            contractPath,
            contractName,
          );

          // Verify contract
          const result = await sourcifyService.verify({
            address,
            chainId: chainId.toString(),
            contractName,
            artifact,
            buildInfo,
            sourcePaths,
          });

          if (result.status === "perfect") {
            console.log("✔ Contract verified successfully (perfect match)");
          } else if (result.status === "partial") {
            console.log("✔ Contract verified successfully (partial match)");
          } else {
            console.error(`✗ Verification failed: ${result.message}`);
          }
        } catch (error: any) {
          console.error(`✗ Verification failed: ${error.message}`);
        }
      }

      const viewUrl = networkConfig.getHashScanUrl(address);
      if (viewUrl) {
        console.log(`\nView on HashScan: ${viewUrl}`);
      } else {
        console.log(
          `\nChain ID ${chainId} is not a recognized Hedera network.`,
        );
      }
    },
  }));

async function extendUserConfig(
  config: HardhatUserConfig,
  next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
): Promise<HardhatUserConfig> {
  const nextConfig = await next(config);

  const hardhatNetwork = process.env.HARDHAT_NETWORK ?? "";
  const explicitApiUrl =
    process.env.HASHSCAN_API_URL ?? process.env.SOURCIFY_API_URL;
  const isLocalNetwork = /^(localhost|hedera_local|local)$/i.test(hardhatNetwork);
  const computedApiUrl =
    explicitApiUrl ??
    (isLocalNetwork ? "http://localhost:8080" : "https://server-verify.hashscan.io");

  const sourcifyConfig = {
    apiUrl: computedApiUrl,
  };

  return {
    ...nextConfig,
    sourcify: sourcifyConfig,
  } as HardhatUserConfig;
}

async function resolveUserConfig(
  userConfig: HardhatUserConfig,
  resolveConfigurationVariable: ConfigurationVariableResolver,
  next: (
    nextUserConfig: HardhatUserConfig,
    nextResolveConfigurationVariable: ConfigurationVariableResolver,
  ) => Promise<HardhatConfig>,
): Promise<HardhatConfig> {
  const resolved = await next(userConfig, resolveConfigurationVariable);

  const nets: Record<string, any> = (resolved as any).networks ?? {};
  
  // Set chain IDs for Hedera networks if not already set
  HEDERA_NETWORKS.forEach((network) => {
    network.names.forEach((name) => {
      if (nets[name] && nets[name].chainId == null) {
        nets[name].chainId = network.chainId;
      }
    });
  });

  return resolved;
}

const plugin: HardhatPlugin = {
  id: "hashscan-verify",
  dependencies: () => [],
  hookHandlers: {
    config: async () => ({
      default: async () => ({
        extendUserConfig,
        resolveUserConfig,
      }),
    }),
  },
  tasks: [hashscanVerifyTask.build()],
};

export default plugin;
