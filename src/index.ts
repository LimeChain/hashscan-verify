
import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { HardhatPlugin } from "hardhat/types/plugins";
import type {
  HardhatUserConfig,
  HardhatConfig,
  ConfigurationVariableResolver,
} from "hardhat/types/config";
import "hardhat/types/tasks";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import https from "https";
import { URL } from "url";

// Helper function to make HTTPS request
function httpsRequest(url: string, options: any, data: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Function to directly verify on Sourcify
async function verifySourcify(
  address: string,
  chainId: string,
  contractName: string,
  hre: HardhatRuntimeEnvironment
): Promise<{ status: string; message?: string }> {
  try {
    // Get the contract artifact path
    const artifactPath = join(
      hre.config.paths.artifacts,
      "contracts",
      `${contractName}.sol`,
      `${contractName}.json`
    );

    if (!existsSync(artifactPath)) {
      throw new Error(`Artifact not found: ${artifactPath}`);
    }

    // Read the artifact
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    
    // Get the build info
    const buildInfoPath = join(
      hre.config.paths.artifacts,
      "build-info",
      `${artifact.buildInfoId}.output.json`
    );

    if (!existsSync(buildInfoPath)) {
      throw new Error(`Build info not found: ${buildInfoPath}`);
    }

    // Read the build info
    const buildInfo = JSON.parse(readFileSync(buildInfoPath, 'utf8'));
    const contractPath = `project/contracts/${contractName}.sol`;
    const contractData = buildInfo.output.contracts[contractPath]?.[contractName];
    
    if (!contractData) {
      throw new Error(`Contract ${contractName} not found in build info`);
    }

    // Prepare the files for verification
    const files: Record<string, string> = {};
    
    // Add metadata
    files["metadata.json"] = contractData.metadata;
    
    // Add source files
    Object.entries(buildInfo.output.sources).forEach(([path, _]: [string, any]) => {
      const normalizedPath = path.replace(/^project\//, '');
      const sourcePath = join(hre.config.paths.root, normalizedPath);
      if (existsSync(sourcePath)) {
        files[normalizedPath] = readFileSync(sourcePath, 'utf8');
      }
    });

    // Prepare the request data
    const requestData = {
      address,
      chain: chainId,
      files
    };

    const jsonData = JSON.stringify(requestData);
    
    // Get Sourcify API URL
    const apiUrl = (hre.config as any).sourcify?.apiUrl || "https://server-verify.hashscan.io";
    const parsedUrl = new URL(`${apiUrl}/verify`);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonData)
      }
    };

    console.log(`[hardhat-hashscan-verify] Calling Sourcify API at ${apiUrl}/verify`);
    
    const response = await httpsRequest(parsedUrl.href, options, jsonData);
    
    console.log("[hardhat-hashscan-verify] Sourcify response:", JSON.stringify(response, null, 2));
    
    if (response.result && response.result.length > 0) {
      const result = response.result[0];
      return {
        status: result.status,
        message: result.message
      };
    }
    
    if (response.error) {
      return {
        status: "error",
        message: response.error
      };
    }
    
    return {
      status: "error",
      message: "Unknown response from Sourcify"
    };
    
  } catch (error: any) {
    console.error("[hardhat-hashscan-verify] Error calling Sourcify:", error);
    return {
      status: "error",
      message: error.message
    };
  }
}

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
        "[hardhat-hashscan-verify] Using direct Sourcify API verification",
      );

      // Extract contract name from the contract parameter (e.g., "contracts/Counter.sol:Counter")
      let contractName = "Counter"; // default
      if (contract) {
        const parts = contract.split(":");
        if (parts.length === 2) {
          contractName = parts[1];
        }
      }

      // Get chain ID
      const connection = await (hre as any).network?.connect();
      const chainId = connection?.networkConfig?.chainId;
      
      if (!chainId) {
        console.error("[hardhat-hashscan-verify] Could not determine chain ID");
        return;
      }

      console.log(`[hardhat-hashscan-verify] Verifying ${contractName} at ${address} on chain ${chainId}`);
      
      // Call Sourcify directly
      const result = await verifySourcify(address, chainId.toString(), contractName, hre);
      
      if (result.status === "perfect") {
        console.log("[hardhat-hashscan-verify] ✓ Contract verified successfully (perfect match)");
      } else if (result.status === "partial") {
        console.log("[hardhat-hashscan-verify] ✓ Contract verified successfully (partial match)");
      } else {
        console.log(`[hardhat-hashscan-verify] ✗ Verification failed: ${result.message || result.status}`);
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

async function extendUserConfig(
  config: HardhatUserConfig,
  next: (nextConfig: HardhatUserConfig) => Promise<HardhatUserConfig>,
): Promise<HardhatUserConfig> {
  const nextConfig = await next(config);

  // Get Sourcify configuration from environment or defaults
  const hardhatNetwork = process.env.HARDHAT_NETWORK ?? "";
  const explicitApiUrl = process.env.HASHSCAN_API_URL ?? process.env.SOURCIFY_API_URL;
  const isLocalNetwork = /^(localhost|hedera_local|local)$/i.test(hardhatNetwork);
  const computedApiUrl =
    explicitApiUrl ?? (isLocalNetwork ? "http://localhost:8080" : "https://server-verify.hashscan.io");

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
  maybeTag("hedera_mainnet", 295);
  maybeTag("hedera_testnet", 296);
  maybeTag("hedera_previewnet", 297);
  maybeTag("hedera_local", 298);

  return resolved;
}

const plugin: HardhatPlugin = {
  id: "hardhat-hashscan-verify",
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
