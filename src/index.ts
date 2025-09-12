
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { HardhatPlugin } from "hardhat/types/plugins";
import type {
  HardhatUserConfig,
  HardhatConfig,
  ConfigurationVariableResolver,
} from "hardhat/types/config";
import "hardhat/types/tasks";

const hashscanVerifyTask = task(
  "hashscan-verify",
  "Verify on HashScan (Sourcify) and print the explorer link",
)
  .addPositionalArgument({
    name: "address",
    description: "Deployed contract address",
  })
  .addOption({
    name: "contract",
    description: "Fully qualified name: path/Contract.sol:ContractName",
    defaultValue: "",
  })
  .addVariadicArgument({
    name: "constructorArgs",
    description: "Constructor arguments",
  })
  .setAction(async () => ({
    default: async (
      args: { address: string; contract: string; constructorArgs?: string[] },
      hre: HardhatRuntimeEnvironment,
    ) => {
      const { address, contract, constructorArgs = [] } = args;

      console.log(
        "[hardhat-hashscan-verify] Delegating to @nomicfoundation/hardhat-verify (Sourcify)",
      );

      await hre.tasks.getTask("verify").run({
        address,
        constructorArgs,
        contract: contract || undefined,
      });

      const connection = await (hre as any).network?.connect();
      const chainId = Number(connection?.id);
      const net =
        chainId === 295
          ? "mainnet"
          : chainId === 296
            ? "testnet"
            : chainId === 297
              ? "previewnet"
              : chainId === 298
                ? "local"
              : undefined;

        switch (net) {
          case "mainnet":
          case "testnet":
          case "previewnet":
            console.log(`\nView on HashScan: https://hashscan.io/${net}/contract/${address}\n`);
            break;
          case "local":
            console.log(`\nView on HashScan: http://localhost:8080/${net}/contract/${address}\n`);
            break;
          default:
            console.log(
              "\nVerified via Sourcify. (Unknown chainId; cannot build HashScan URL)\n",
            );
        }
    },
  }));

// Hooks to extend and resolve config in Hardhat v3
async function extendUserConfig(
  config: HardhatUserConfig,
  next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
): Promise<HardhatUserConfig> {
  const nextConfig = await next(config);

  const userVerify: any = (nextConfig as any).verify ?? {};
  const userSourcify: any = userVerify.sourcify ?? {};

  const mergedVerify: any = {
    ...(nextConfig as any).verify,
    sourcify: {
      enabled: userSourcify.enabled ?? true,
      apiUrl: userSourcify.apiUrl ?? "https://server-verify.hashscan.io",
      browserUrl: userSourcify.browserUrl ?? "https://hashscan.io",
    },
  };

  return {
    ...nextConfig,
    verify: mergedVerify,
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

  // Convenience: if user defined Hedera networks without chainIds, set them.
  const nets: Record<string, any> = (resolved as any).networks ?? {};
  const maybeTag = (n: string, id: number) => {
    if (nets[n] && nets[n].chainId == null) nets[n].chainId = id;
  };
  maybeTag("hedera_mainnet", 295);
  maybeTag("hedera_testnet", 296);
  maybeTag("hedera_previewnet", 297);
  maybeTag("hedera_local", 298);

  return resolved;
}

const plugin: HardhatPlugin = {
  id: "hardhat-hashscan-verify",
  dependencies: () => [import("@nomicfoundation/hardhat-verify")],
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
