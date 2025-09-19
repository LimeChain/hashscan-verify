import { CHAIN_IDS, NetworkConfig } from '../../config/networks.js';
import { ValidationService } from '../validation-service.js';

describe('ValidationService', () => {
  let validator: ValidationService;

  beforeEach(() => {
    validator = new ValidationService();
  });

  describe('validateInput', () => {
    it('should accept valid address and contract', () => {
      const error = validator.validateInput(
        '0x7A0505Eb4af57Eefb9B69619DB3bfc26348DE73A',
        'contracts/Counter.sol:Counter'
      );
      expect(error).toBeNull();
    });

    it('should reject invalid address format', () => {
      const error = validator.validateInput(
        'invalid-address',
        'contracts/Counter.sol:Counter'
      );
      expect(error).toContain('Invalid contract address format');
    });

    it('should reject missing contract parameter', () => {
      const error = validator.validateInput(
        '0x7A0505Eb4af57Eefb9B69619DB3bfc26348DE73A',
        ''
      );
      expect(error).toContain('Contract parameter is required');
    });

    it('should reject invalid contract format', () => {
      const error = validator.validateInput(
        '0x7A0505Eb4af57Eefb9B69619DB3bfc26348DE73A',
        'invalid-format'
      );
      expect(error).toContain('Invalid contract format');
    });
  });

  describe('parseContract', () => {
    it('should parse valid contract format', () => {
      const result = validator.parseContract('contracts/Counter.sol:Counter');
      expect(result).toEqual({
        contractPath: 'contracts/Counter.sol',
        contractName: 'Counter',
      });
    });

    it('should handle nested paths', () => {
      const result = validator.parseContract('contracts/tokens/ERC20.sol:Token');
      expect(result).toEqual({
        contractPath: 'contracts/tokens/ERC20.sol',
        contractName: 'Token',
      });
    });

    it('should throw on invalid format', () => {
      expect(() => validator.parseContract('invalid')).toThrow(
        'Invalid contract format'
      );
    });
  });

  describe('isValidChainId', () => {
    it('should accept valid chain IDs', () => {
      expect(validator.isValidChainId(295)).toBe(true);
      expect(validator.isValidChainId(296)).toBe(true);
      expect(validator.isValidChainId(0)).toBe(true);
    });

    it('should reject invalid chain IDs', () => {
      expect(validator.isValidChainId(undefined)).toBe(false);
      expect(validator.isValidChainId(null as any)).toBe(false);
      expect(validator.isValidChainId(NaN)).toBe(false);
    });
  });
});

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
});
