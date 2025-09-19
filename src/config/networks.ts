export interface HederaNetwork {
    chainId: number;
    networkName: string;
    names: string[];
    hashScanBaseUrl?: string;
    defaultApiUrl: string;
    getHashScanUrl(address: string): string | undefined;
  }
  
  // Chain ID constants
  export const CHAIN_IDS = {
    MAINNET: 295,
    TESTNET: 296,
    PREVIEWNET: 297,
    LOCAL: 298,
  } as const;
  
  // Helper class to create HederaNetwork objects with methods
  class HederaNetworkImpl implements HederaNetwork {
    constructor(
      public chainId: number,
      public networkName: string,
      public names: string[],
      public defaultApiUrl: string,
      public hashScanBaseUrl?: string,
    ) {}
  
    getHashScanUrl(address: string): string | undefined {
      return this.hashScanBaseUrl 
        ? `${this.hashScanBaseUrl}/contract/${address}`
        : undefined;
    }
  }
  
  // Network configurations
  export const HEDERA_NETWORKS: HederaNetwork[] = [
    new HederaNetworkImpl(
      CHAIN_IDS.MAINNET,
      "mainnet",
      ["mainnet", "hedera_mainnet"],
      "https://server-verify.hashscan.io",
      "https://hashscan.io/mainnet",
    ),
    new HederaNetworkImpl(
      CHAIN_IDS.TESTNET,
      "testnet",
      ["testnet", "hedera_testnet"],
      "https://server-verify.hashscan.io",
      "https://hashscan.io/testnet",
    ),
    new HederaNetworkImpl(
      CHAIN_IDS.PREVIEWNET,
      "previewnet",
      ["previewnet", "hedera_previewnet"],
      "https://server-verify.hashscan.io",
      "https://hashscan.io/previewnet",
    ),
    new HederaNetworkImpl(
      CHAIN_IDS.LOCAL,
      "local",
      ["local", "hedera_local", "localhost"],
      "http://localhost:8080",
      "http://localhost:8080/local",
    ),
  ];
  
  export class NetworkConfig {
    private static readonly networks = new Map<number, HederaNetwork>(
      HEDERA_NETWORKS.map(network => [network.chainId, network])
    );
  
    static fromChainId(chainId: number): HederaNetwork {
      const network = this.networks.get(chainId);
      if (!network) {
        // Return a default configuration for unknown networks
        return new HederaNetworkImpl(
          chainId,
          "unknown",
          [],
          "https://server-verify.hashscan.io",
        );
      }
      return network;
    }
  
    static getNetworkName(chainId: number): string | undefined {
      return this.networks.get(chainId)?.networkName;
    }
  
    static isHederaNetwork(chainId: number): boolean {
      return this.networks.has(chainId);
    }
  }
