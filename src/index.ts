
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";
import { URL } from "url";

import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { HardhatPlugin } from "hardhat/types/plugins";
import type {
  HardhatUserConfig,
  HardhatConfig,
  ConfigurationVariableResolver,
} from "hardhat/types/config";
import "hardhat/types/tasks";

// Helper function to make HTTPS request
function httpsRequest(
  url: string,
  options: https.RequestOptions,
  data?: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on("error", reject);
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// Function to check if contract is already verified
async function checkIfVerified(
  address: string,
  chainId: string,
  apiUrl: string,
): Promise<{ isVerified: boolean; status?: string }> {
  try {
    const parsedUrl = new URL(`${apiUrl}/check-all-by-addresses`);
    parsedUrl.searchParams.append("addresses", address.toLowerCase());
    parsedUrl.searchParams.append("chainIds", chainId);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    };

    const response = await httpsRequest(parsedUrl.href, options);

    if (Array.isArray(response) && response.length > 0) {
      const result = response[0];
      if (result.chainIds && Array.isArray(result.chainIds)) {
        const chainResult = result.chainIds.find(
          (c: any) => c.chainId === chainId,
        );
        if (chainResult) {
          return {
            isVerified: true,
            status: chainResult.status,
          };
        }
      }
    }

    return { isVerified: false };
  } catch (error) {
    // If check fails, proceed with verification anyway
    return { isVerified: false };
  }
}

// Function to directly verify on Sourcify
async function verifySourcify(
  address: string,
  chainId: string,
  contractPath: string,
  contractName: string,
  hre: HardhatRuntimeEnvironment,
): Promise<{ status: string; message?: string }> {
  try {
    // Normalize contract path (remove 'contracts/' prefix if present)
    const normalizedPath = contractPath.replace(/^contracts\//, "");

    // Try to find the artifact - Hardhat stores artifacts in contracts/Contract.sol/Contract.json
    const possiblePaths = [
      // Direct path: artifacts/contracts/Counter.sol/Counter.json
      join(hre.config.paths.artifacts, contractPath, `${contractName}.json`),
      // Alternative: artifacts/contracts/Counter/Counter.json (if user provided contracts/Counter:Counter)
      join(
        hre.config.paths.artifacts,
        contractPath.replace(/\.sol$/, ""),
        `${contractName}.json`,
      ),
      // Fallback: try in contracts directory directly
      join(hre.config.paths.artifacts, "contracts", contractPath, `${contractName}.json`),
      // Another fallback: normalize path and try
      join(
        hre.config.paths.artifacts,
        "contracts",
        contractPath.replace(/^contracts\//, "").replace(/\.sol$/, ""),
        `${contractName}.json`,
      ),
    ];

    let artifactPath: string | undefined;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        artifactPath = path;
        break;
      }
    }

    if (!artifactPath) {
      // Provide helpful debugging info
      const artifactsDir = hre.config.paths.artifacts;
      throw new Error(
        `Could not find artifact for ${contractName}. ` +
          `Expected artifact at: ${join(artifactsDir, contractPath, `${contractName}.json`)}\n` +
          `Make sure:\n` +
          `1. The contract is compiled: run 'npx hardhat compile'\n` +
          `2. The contract path matches exactly: use format 'contracts/File.sol:ContractName'\n` +
          `3. The contract name matches the artifact name exactly`,
      );
    }

    // Read the artifact
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

    if (!artifact.buildInfoId) {
      throw new Error(
        `Build info ID not found in artifact. ` +
          `Please recompile your contracts with 'npx hardhat compile --force'.`,
      );
    }

    // Get the build info
    const buildInfoPath = join(
      hre.config.paths.artifacts,
      "build-info",
      `${artifact.buildInfoId}.output.json`,
    );

    if (!existsSync(buildInfoPath)) {
      throw new Error(
        `Build info not found. ` +
          `Please recompile your contracts with 'npx hardhat compile --force'.`,
      );
    }

    // Read the build info
    const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));

    // Find the contract in build info
    let contractData: any;
    let foundPath: string | undefined;

    for (const [path, contracts] of Object.entries(buildInfo.output.contracts)) {
      if (contracts && typeof contracts === "object" && contractName in contracts) {
        contractData = (contracts as any)[contractName];
        foundPath = path;
        break;
      }
    }

    if (!contractData || !contractData.metadata) {
      throw new Error(
        `Contract ${contractName} not found in build output. ` +
          `Make sure the contract name matches exactly.`,
      );
    }

    // Prepare the files for verification
    const files: Record<string, string> = {};

    // Add metadata
    files["metadata.json"] = contractData.metadata;

    // Add source files
    Object.entries(buildInfo.output.sources).forEach(
      ([path, _]: [string, any]) => {
        const normalizedPath = path.replace(/^project\//, "");
        const sourcePath = join(hre.config.paths.root, normalizedPath);
        if (existsSync(sourcePath)) {
          files[normalizedPath] = readFileSync(sourcePath, "utf8");
        }
      },
    );

    // Prepare the request data
    const requestData = {
      address,
      chain: chainId,
      files,
    };

    const jsonData = JSON.stringify(requestData);

    // Get Sourcify API URL
    const apiUrl =
      (hre.config as any).sourcify?.apiUrl || "https://server-verify.hashscan.io";
    const parsedUrl = new URL(`${apiUrl}/verify`);

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(jsonData),
      },
    };

    const response = await httpsRequest(parsedUrl.href, options, jsonData);

    if (response.result && response.result.length > 0) {
      const result = response.result[0];
      return {
        status: result.status,
        message: result.message,
      };
    }

    if (response.error) {
      return {
        status: "error",
        message: response.error,
      };
    }

    return {
      status: "error",
      message: "Unexpected response format from verification service",
    };
  } catch (error: any) {
    return {
      status: "error",
      message: error.message || "Unknown error occurred during verification",
    };
  }
}

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

      // Validate address format
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        console.error(
          "Error: Invalid contract address format. Expected format: 0x followed by 40 hexadecimal characters.",
        );
        return;
      }

      // Extract contract path and name from the contract parameter
      let contractPath = "";
      let contractName = "";

      if (!contract) {
        console.error(
          "Error: Contract parameter is required. Format: path/to/Contract.sol:ContractName",
        );
        return;
      }

      const parts = contract.split(":");
      if (parts.length !== 2) {
        console.error(
          "Error: Invalid contract format. Expected format: path/to/Contract.sol:ContractName",
        );
        return;
      }

      const [fullPath, name] = parts;
      // Keep the .sol extension for the contract path as Hardhat uses it in artifact directory structure
      contractPath = fullPath;
      contractName = name;

      // Get chain ID
      const connection = await (hre as any).network?.connect();
      const chainId = connection?.networkConfig?.chainId;

      if (!chainId) {
        console.error(
          "Error: Could not determine chain ID. Make sure you're using the --network flag.",
        );
        return;
      }

      // Get Sourcify API URL
      const apiUrl =
        (hre.config as any).sourcify?.apiUrl || "https://server-verify.hashscan.io";

      // Check if already verified
      const verificationCheck = await checkIfVerified(
        address,
        chainId.toString(),
        apiUrl,
      );

      if (verificationCheck.isVerified) {
        console.log(
          `Contract is already verified with ${verificationCheck.status} match.`,
        );
      } else {
        console.log(`Verifying ${contractName} at ${address}...`);

        // Call Sourcify directly
        const result = await verifySourcify(
          address,
          chainId.toString(),
          contractPath,
          contractName,
          hre,
        );

        if (result.status === "perfect") {
          console.log("✓ Contract verified successfully (perfect match)");
        } else if (result.status === "partial") {
          console.log("✓ Contract verified successfully (partial match)");
        } else {
          console.error(`✗ Verification failed: ${result.message}`);
        }
      }

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
          console.log(
            `\nView on HashScan: https://hashscan.io/${net}/contract/${address}`,
          );
          break;
        case "local":
          console.log(
            `\nView on HashScan: http://localhost:8080/${net}/contract/${address}`,
          );
          break;
        default:
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

  // Get Sourcify configuration from environment or defaults
  const hardhatNetwork = process.env.HARDHAT_NETWORK ?? "";
  const explicitApiUrl =
    process.env.HASHSCAN_API_URL ?? process.env.SOURCIFY_API_URL;
  const isLocalNetwork = /^(localhost|hedera_local|local)$/i.test(hardhatNetwork);
  const computedApiUrl =
    explicitApiUrl ??
    (isLocalNetwork ? "http://localhost:8080" : "https://server-verify.hashscan.io");

  // Store Sourcify API URL in config for later use
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

  // Convenience: if user defined Hedera networks without chainIds, we set them.
  const nets: Record<string, any> = (resolved as any).networks ?? {};
  const maybeTag = (n: string, id: number) => {
    if (nets[n] && nets[n].chainId == null) nets[n].chainId = id;
  };

  // Support both old hedera_* names and new simplified names
  maybeTag("hedera_mainnet", 295);
  maybeTag("hedera_testnet", 296);
  maybeTag("hedera_previewnet", 297);
  maybeTag("hedera_local", 298);

  maybeTag("mainnet", 295);
  maybeTag("testnet", 296);
  maybeTag("previewnet", 297);
  maybeTag("local", 298);

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
