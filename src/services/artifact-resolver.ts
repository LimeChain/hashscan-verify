import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";

export interface ResolvedArtifact {
  artifact: any;
  buildInfo: any;
  sourcePaths: Map<string, string>;
}

export class ArtifactResolver {
  constructor(private readonly hre: HardhatRuntimeEnvironment) {}

  async resolve(
    contractPath: string,
    contractName: string,
  ): Promise<ResolvedArtifact> {
    // Find artifact
    const artifactPath = this.findArtifactPath(contractPath, contractName);
    
    if (!artifactPath) {
      throw new Error(this.getArtifactNotFoundError(contractPath, contractName));
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
    const buildInfoPath = this.getBuildInfoPath(artifact.buildInfoId);

    if (!existsSync(buildInfoPath)) {
      throw new Error(
        `Build info not found. ` +
          `Please recompile your contracts with 'npx hardhat compile --force'.`,
      );
    }

    // Read the build info
    const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf8"));

    // Map source paths
    const sourcePaths = this.mapSourcePaths(buildInfo);

    return {
      artifact,
      buildInfo,
      sourcePaths,
    };
  }

  private findArtifactPath(
    contractPath: string,
    contractName: string,
  ): string | undefined {
    const possiblePaths = this.generatePossibleArtifactPaths(
      contractPath,
      contractName,
    );

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return undefined;
  }

  private generatePossibleArtifactPaths(
    contractPath: string,
    contractName: string,
  ): string[] {
    const { artifacts } = this.hre.config.paths;
    
    // Normalize contract path (remove 'contracts/' prefix if present)
    const normalizedPath = contractPath.replace(/^contracts\//, "");

    return [
      // Direct path: artifacts/contracts/Counter.sol/Counter.json
      join(artifacts, contractPath, `${contractName}.json`),
      // Alternative: artifacts/contracts/Counter/Counter.json (if user provided contracts/Counter:Counter)
      join(
        artifacts,
        contractPath.replace(/\.sol$/, ""),
        `${contractName}.json`,
      ),
      // Fallback: try in contracts directory directly
      join(artifacts, "contracts", contractPath, `${contractName}.json`),
      // Another fallback: normalize path and try
      join(
        artifacts,
        "contracts",
        normalizedPath.replace(/\.sol$/, ""),
        `${contractName}.json`,
      ),
    ];
  }

  private getBuildInfoPath(buildInfoId: string): string {
    return join(
      this.hre.config.paths.artifacts,
      "build-info",
      `${buildInfoId}.output.json`,
    );
  }

  private mapSourcePaths(buildInfo: any): Map<string, string> {
    const sourcePaths = new Map<string, string>();
    
    Object.entries(buildInfo.output.sources).forEach(
      ([path, _]: [string, any]) => {
        const normalizedPath = path.replace(/^project\//, "");
        const sourcePath = join(this.hre.config.paths.root, normalizedPath);
        sourcePaths.set(normalizedPath, sourcePath);
      },
    );

    return sourcePaths;
  }

  private getArtifactNotFoundError(
    contractPath: string,
    contractName: string,
  ): string {
    const artifactsDir = this.hre.config.paths.artifacts;
    return (
      `Could not find artifact for ${contractName}. ` +
      `Expected artifact at: ${join(artifactsDir, contractPath, `${contractName}.json`)}\n` +
      `Make sure:\n` +
      `1. The contract is compiled: run 'npx hardhat compile'\n` +
      `2. The contract path matches exactly: use format 'contracts/File.sol:ContractName'\n` +
      `3. The contract name matches the artifact name exactly`
    );
  }
}
