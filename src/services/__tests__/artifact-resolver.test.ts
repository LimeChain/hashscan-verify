import { ArtifactResolver } from '../artifact-resolver.js';
import { readFileSync, existsSync } from 'fs';
import type { HardhatRuntimeEnvironment } from 'hardhat/types/hre';

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

describe('ArtifactResolver', () => {
  let resolver: ArtifactResolver;
  let mockHre: HardhatRuntimeEnvironment;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHre = {
      config: {
        paths: {
          artifacts: '/project/artifacts',
          root: '/project',
        },
      },
    } as unknown as HardhatRuntimeEnvironment;

    resolver = new ArtifactResolver(mockHre);
  });

  describe('resolve', () => {
    it('should successfully resolve artifact and build info', async () => {
      const mockArtifact = {
        buildInfoId: 'build-123',
        abi: [],
      };

      const mockBuildInfo = {
        output: {
          contracts: {
            'contracts/Counter.sol': {
              Counter: {
                metadata: '{"compiler": "0.8.0"}',
              },
            },
          },
          sources: {
            'project/contracts/Counter.sol': {},
            'project/contracts/interfaces/ICounter.sol': {},
          },
        },
      };

      // Mock file system calls
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) return true;
        if (path.includes('build-123.output.json')) return true;
        if (path.includes('contracts/Counter.sol')) return true;
        return false;
      });

      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) {
          return JSON.stringify(mockArtifact);
        }
        if (path.includes('build-123.output.json')) {
          return JSON.stringify(mockBuildInfo);
        }
        return '';
      });

      const result = await resolver.resolve('contracts/Counter.sol', 'Counter');

      expect(result).toHaveProperty('artifact');
      expect(result).toHaveProperty('buildInfo');
      expect(result).toHaveProperty('sourcePaths');
      expect(result.artifact).toEqual(mockArtifact);
      expect(result.buildInfo).toEqual(mockBuildInfo);
    });

    it('should throw error when artifact not found', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        resolver.resolve('contracts/Missing.sol', 'Missing')
      ).rejects.toThrow('Could not find artifact for Missing');
    });

    it('should throw error when build info ID is missing', async () => {
      const mockArtifact = {
        abi: [], // No buildInfoId
      };

      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('Counter.json');
      });

      (readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockArtifact));

      await expect(
        resolver.resolve('contracts/Counter.sol', 'Counter')
      ).rejects.toThrow('Build info ID not found in artifact');
    });

    it('should throw error when build info file not found', async () => {
      const mockArtifact = {
        buildInfoId: 'build-123',
      };

      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) return true;
        if (path.includes('build-123.output.json')) return false;
        return false;
      });

      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) {
          return JSON.stringify(mockArtifact);
        }
        return '';
      });

      await expect(
        resolver.resolve('contracts/Counter.sol', 'Counter')
      ).rejects.toThrow('Build info not found');
    });

    it('should try multiple paths to find artifact', async () => {
      const mockArtifact = {
        buildInfoId: 'build-123',
      };

      const mockBuildInfo = {
        output: {
          contracts: {},
          sources: {},
        },
      };

      let callCount = 0;
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        callCount++;
        // Only return true for the third path tried
        if (callCount === 3 && path.includes('Counter.json')) return true;
        if (path.includes('build-123.output.json')) return true;
        return false;
      });

      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) {
          return JSON.stringify(mockArtifact);
        }
        if (path.includes('build-123.output.json')) {
          return JSON.stringify(mockBuildInfo);
        }
        return '';
      });

      const result = await resolver.resolve('Counter.sol', 'Counter');
      
      expect(result).toHaveProperty('artifact');
      expect(existsSync).toHaveBeenCalledTimes(4); // 3 for artifact, 1 for build info
    });

    it('should normalize contract path by removing contracts/ prefix', async () => {
      const mockArtifact = {
        buildInfoId: 'build-123',
      };

      const mockBuildInfo = {
        output: {
          contracts: {},
          sources: {},
        },
      };

      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) return true;
        if (path.includes('build-123.output.json')) return true;
        return false;
      });

      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) {
          return JSON.stringify(mockArtifact);
        }
        if (path.includes('build-123.output.json')) {
          return JSON.stringify(mockBuildInfo);
        }
        return '';
      });

      await resolver.resolve('contracts/Counter.sol', 'Counter');

      // Check that existsSync was called with paths that handle the contracts/ prefix
      expect(existsSync).toHaveBeenCalledWith(
        expect.stringContaining('artifacts/contracts/Counter.sol/Counter.json')
      );
    });

    it('should map source paths correctly', async () => {
      const mockArtifact = {
        buildInfoId: 'build-123',
      };

      const mockBuildInfo = {
        output: {
          contracts: {},
          sources: {
            'project/contracts/Counter.sol': {},
            'project/contracts/lib/Math.sol': {},
            'contracts/interfaces/ICounter.sol': {},
          },
        },
      };

      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) return true;
        if (path.includes('build-123.output.json')) return true;
        return false;
      });

      (readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes('Counter.json')) {
          return JSON.stringify(mockArtifact);
        }
        if (path.includes('build-123.output.json')) {
          return JSON.stringify(mockBuildInfo);
        }
        return '';
      });

      const result = await resolver.resolve('contracts/Counter.sol', 'Counter');

      expect(result.sourcePaths).toBeInstanceOf(Map);
      expect(result.sourcePaths.size).toBe(3);
      expect(result.sourcePaths.get('contracts/Counter.sol')).toBe(
        '/project/contracts/Counter.sol'
      );
    });
  });
});
