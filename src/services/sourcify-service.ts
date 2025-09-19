import https from "https";
import { URL } from "url";
import { readFileSync, existsSync } from "fs";

export interface VerificationResult {
  status: string;
  message?: string;
}

export interface VerificationCheck {
  isVerified: boolean;
  status?: string;
}

export interface VerificationPayload {
  address: string;
  chainId: string;
  contractName: string;
  artifact: any;
  buildInfo: any;
  sourcePaths: Map<string, string>;
}

export class SourcifyService {
  constructor(private readonly apiUrl: string) {}

  async checkIfVerified(
    address: string,
    chainId: string,
  ): Promise<VerificationCheck> {
    try {
      const parsedUrl = new URL(`${this.apiUrl}/check-all-by-addresses`);
      parsedUrl.searchParams.append("addresses", address.toLowerCase());
      parsedUrl.searchParams.append("chainIds", chainId);

      const response = await this.makeRequest(parsedUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

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

  async verify(payload: VerificationPayload): Promise<VerificationResult> {
    const { address, chainId, contractName, artifact, buildInfo, sourcePaths } = payload;

    // Find the contract in build info
    const contractData = this.findContractInBuildInfo(
      buildInfo,
      contractName,
    );

    if (!contractData || !contractData.metadata) {
      throw new Error(
        `Contract ${contractName} not found in build output. ` +
          `Make sure the contract name matches exactly.`,
      );
    }

    // Prepare the files for verification
    const files = this.prepareVerificationFiles(
      contractData,
      buildInfo,
      sourcePaths,
    );

    // Send verification request
    const requestData = {
      address,
      chain: chainId,
      files,
    };

    const parsedUrl = new URL(`${this.apiUrl}/verify`);
    const jsonData = JSON.stringify(requestData);

    const response = await this.makeRequest(parsedUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(jsonData).toString(),
      },
    }, jsonData);

    return this.parseVerificationResponse(response);
  }

  private findContractInBuildInfo(
    buildInfo: any,
    contractName: string,
  ): any {
    for (const [path, contracts] of Object.entries(buildInfo.output.contracts)) {
      if (contracts && typeof contracts === "object" && contractName in contracts) {
        return (contracts as any)[contractName];
      }
    }
    return null;
  }

  private prepareVerificationFiles(
    contractData: any,
    buildInfo: any,
    sourcePaths: Map<string, string>,
  ): Record<string, string> {
    const files: Record<string, string> = {};

    // Add metadata
    files["metadata.json"] = contractData.metadata;

    // Add source files
    Object.entries(buildInfo.output.sources).forEach(
      ([path, _]: [string, any]) => {
        const normalizedPath = path.replace(/^project\//, "");
        const sourcePath = sourcePaths.get(normalizedPath);
        
        if (sourcePath && existsSync(sourcePath)) {
          files[normalizedPath] = readFileSync(sourcePath, "utf8");
        }
      },
    );

    return files;
  }

  private parseVerificationResponse(response: any): VerificationResult {
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
  }

  private makeRequest(
    url: URL,
    options: https.RequestOptions,
    data?: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        ...options,
      };

      const req = https.request(url.href, requestOptions, (res) => {
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
}
