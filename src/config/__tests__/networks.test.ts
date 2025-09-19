import { NetworkConfig, CHAIN_IDS, HEDERA_NETWORKS } from '../networks.js';

describe('NetworkConfig', () => {
  describe('fromChainId', () => {
    it('should return correct network for mainnet', () => {
      const network = NetworkConfig.fromChainId(CHAIN_IDS.MAINNET);
      expect(network.networkName).toBe('mainnet');
      expect(network.chainId).toBe(295);
    });

    it('should return correct network for testnet', () => {
      const network = NetworkConfig.fromChainId(CHAIN_IDS.TESTNET);
      expect(network.networkName).toBe('testnet');
      expect(network.chainId).toBe(296);
    });

    it('should return correct network for previewnet', () => {
      const network = NetworkConfig.fromChainId(CHAIN_IDS.PREVIEWNET);
      expect(network.networkName).toBe('previewnet');
      expect(network.chainId).toBe(297);
    });

    it('should return correct network for local', () => {
      const network = NetworkConfig.fromChainId(CHAIN_IDS.LOCAL);
      expect(network.networkName).toBe('local');
      expect(network.chainId).toBe(298);
    });

    it('should return default config for unknown chain', () => {
      const network = NetworkConfig.fromChainId(999);
      expect(network.networkName).toBe('unknown');
      expect(network.chainId).toBe(999);
    });
  });

  describe('getNetworkName', () => {
    it('should return network name for known chains', () => {
      expect(NetworkConfig.getNetworkName(CHAIN_IDS.MAINNET)).toBe('mainnet');
      expect(NetworkConfig.getNetworkName(CHAIN_IDS.TESTNET)).toBe('testnet');
      expect(NetworkConfig.getNetworkName(CHAIN_IDS.PREVIEWNET)).toBe('previewnet');
      expect(NetworkConfig.getNetworkName(CHAIN_IDS.LOCAL)).toBe('local');
    });

    it('should return undefined for unknown chains', () => {
      expect(NetworkConfig.getNetworkName(999)).toBeUndefined();
    });
  });

  describe('isHederaNetwork', () => {
    it('should identify Hedera networks', () => {
      expect(NetworkConfig.isHederaNetwork(295)).toBe(true);
      expect(NetworkConfig.isHederaNetwork(296)).toBe(true);
      expect(NetworkConfig.isHederaNetwork(297)).toBe(true);
      expect(NetworkConfig.isHederaNetwork(298)).toBe(true);
    });

    it('should reject non-Hedera networks', () => {
      expect(NetworkConfig.isHederaNetwork(1)).toBe(false);
      expect(NetworkConfig.isHederaNetwork(999)).toBe(false);
    });
  });

  describe('getHashScanUrl', () => {
    it('should generate correct URLs for each network', () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      const mainnet = NetworkConfig.fromChainId(CHAIN_IDS.MAINNET);
      expect(mainnet.getHashScanUrl(address)).toBe(
        `https://hashscan.io/mainnet/contract/${address}`
      );

      const testnet = NetworkConfig.fromChainId(CHAIN_IDS.TESTNET);
      expect(testnet.getHashScanUrl(address)).toBe(
        `https://hashscan.io/testnet/contract/${address}`
      );

      const previewnet = NetworkConfig.fromChainId(CHAIN_IDS.PREVIEWNET);
      expect(previewnet.getHashScanUrl(address)).toBe(
        `https://hashscan.io/previewnet/contract/${address}`
      );

      const local = NetworkConfig.fromChainId(CHAIN_IDS.LOCAL);
      expect(local.getHashScanUrl(address)).toBe(
        `http://localhost:8080/local/contract/${address}`
      );
    });

    it('should return undefined for unknown networks', () => {
      const unknown = NetworkConfig.fromChainId(999);
      expect(unknown.getHashScanUrl('0x123')).toBeUndefined();
    });
  });

  describe('HEDERA_NETWORKS', () => {
    it('should export all network configurations', () => {
      expect(HEDERA_NETWORKS).toHaveLength(4);
      expect(HEDERA_NETWORKS.map(n => n.chainId)).toEqual([295, 296, 297, 298]);
    });

    it('should have correct network names', () => {
      const networkNames = HEDERA_NETWORKS.map(n => n.networkName);
      expect(networkNames).toEqual(['mainnet', 'testnet', 'previewnet', 'local']);
    });

    it('should have multiple name aliases for each network', () => {
      HEDERA_NETWORKS.forEach(network => {
        expect(network.names.length).toBeGreaterThanOrEqual(2);
        expect(network.names).toContain(network.networkName);
      });
    });
  });
});
