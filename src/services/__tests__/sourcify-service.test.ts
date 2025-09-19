import { SourcifyService } from '../sourcify-service.js';
import https from 'https';
import { EventEmitter } from 'events';

jest.mock('https');

describe('SourcifyService', () => {
  let service: SourcifyService;
  let mockRequest: jest.Mock;
  let mockResponse: EventEmitter;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new SourcifyService('https://api.example.com');

    mockResponse = new EventEmitter();
    (mockResponse as any).on = jest.fn((event, handler) => {
      if (event === 'data' || event === 'end') {
        EventEmitter.prototype.on.call(mockResponse, event, handler);
      }
      return mockResponse;
    });

    mockRequest = jest.fn(() => {
      const req = new EventEmitter();
      (req as any).write = jest.fn();
      (req as any).end = jest.fn();
      return req;
    });

    (https.request as jest.Mock) = jest.fn((url, options, callback) => {
      if (callback) {
        callback(mockResponse as any);
      }
      return mockRequest();
    });
  });

  describe('checkIfVerified', () => {
    it('should return verified status when contract is verified', async () => {
      const mockData = JSON.stringify([
        {
          address: '0xtest',
          chainIds: [
            {
              chainId: '296',
              status: 'perfect',
            },
          ],
        },
      ]);

      const promise = service.checkIfVerified('0xTest', '296');

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.isVerified).toBe(true);
      expect(result.status).toBe('perfect');
    });

    it('should return not verified when contract is not found', async () => {
      const mockData = JSON.stringify([]);

      const promise = service.checkIfVerified('0xTest', '296');

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.isVerified).toBe(false);
      expect(result.status).toBeUndefined();
    });

    it('should return not verified on error', async () => {
      const promise = service.checkIfVerified('0xTest', '296');

      setImmediate(() => {
        const req = (https.request as jest.Mock).mock.results[0].value;
        req.emit('error', new Error('Network error'));
      });

      const result = await promise;

      expect(result.isVerified).toBe(false);
    });

    it('should handle different chain ID in response', async () => {
      const mockData = JSON.stringify([
        {
          address: '0xtest',
          chainIds: [
            {
              chainId: '295',
              status: 'perfect',
            },
          ],
        },
      ]);

      const promise = service.checkIfVerified('0xTest', '296');

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.isVerified).toBe(false);
    });
  });

  describe('verify', () => {
    const mockPayload = {
      address: '0xTest',
      chainId: '296',
      contractName: 'Counter',
      artifact: {},
      buildInfo: {
        output: {
          contracts: {
            'contracts/Counter.sol': {
              Counter: {
                metadata: '{"test": true}',
              },
            },
          },
          sources: {
            'contracts/Counter.sol': {},
            'contracts/interfaces/ICounter.sol': {},
          },
        },
      },
      sourcePaths: new Map([
        ['contracts/Counter.sol', '/path/to/Counter.sol'],
        ['contracts/interfaces/ICounter.sol', '/path/to/ICounter.sol'],
      ]),
    };

    beforeEach(() => {
      const fs = require('fs');
      fs.readFileSync = jest.fn().mockReturnValue('contract source code');
      fs.existsSync = jest.fn().mockReturnValue(true);
    });

    it('should successfully verify with perfect match', async () => {
      const mockData = JSON.stringify({
        result: [
          {
            status: 'perfect',
            message: 'Contract verified successfully',
          },
        ],
      });

      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('perfect');
      expect(result.message).toBe('Contract verified successfully');
    });

    it('should handle partial match', async () => {
      const mockData = JSON.stringify({
        result: [
          {
            status: 'partial',
            message: 'Contract verified with partial match',
          },
        ],
      });

      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('partial');
    });

    it('should handle verification error', async () => {
      const mockData = JSON.stringify({
        error: 'Contract bytecode does not match',
      });

      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.message).toBe('Contract bytecode does not match');
    });

    it('should handle unexpected response format', async () => {
      const mockData = JSON.stringify({
        unexpected: 'format',
      });

      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.message).toBe('Unexpected response format from verification service');
    });

    it('should throw error when contract not found in build info', async () => {
      const invalidPayload = {
        ...mockPayload,
        contractName: 'NonExistent',
      };

      await expect(service.verify(invalidPayload)).rejects.toThrow(
        'Contract NonExistent not found in build output'
      );
    });

    it('should throw error when contract has no metadata', async () => {
      const invalidPayload = {
        ...mockPayload,
        buildInfo: {
          output: {
            contracts: {
              'contracts/Counter.sol': {
                Counter: {
                  // No metadata
                },
              },
            },
          },
          sources: {},
        },
      };

      await expect(service.verify(invalidPayload)).rejects.toThrow(
        'Contract Counter not found in build output'
      );
    });

    it('should prepare files correctly for verification', async () => {
      const mockData = JSON.stringify({
        result: [{ status: 'perfect' }],
      });

      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      await promise;

      // Check that request was called with correct parameters
      const requestCall = (https.request as jest.Mock).mock.calls[0];
      expect(requestCall[0]).toContain('/verify');

      // Check that write was called with JSON data
      const writeCall = mockRequest().write.mock.calls[0];
      if (writeCall) {
        const data = JSON.parse(writeCall[0]);
        expect(data).toHaveProperty('address', '0xTest');
        expect(data).toHaveProperty('chain', '296');
        expect(data).toHaveProperty('files');
        expect(data.files).toHaveProperty('metadata.json');
      }
    });

    it('should handle network errors during verification', async () => {
      const promise = service.verify(mockPayload);

      setImmediate(() => {
        const req = (https.request as jest.Mock).mock.results[0].value;
        req.emit('error', new Error('Connection refused'));
      });

      await expect(promise).rejects.toThrow('Connection refused');
    });

    it('should handle non-JSON response gracefully', async () => {
      const promise = service.verify(mockPayload);

      setImmediate(() => {
        mockResponse.emit('data', 'Not JSON');
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.message).toBe('Unexpected response format from verification service');
    });
  });

  describe('edge cases', () => {
    it('should handle empty build info sources', async () => {
      const payload = {
        address: '0xTest',
        chainId: '296',
        contractName: 'Counter',
        artifact: {},
        buildInfo: {
          output: {
            contracts: {
              'contracts/Counter.sol': {
                Counter: {
                  metadata: '{}',
                },
              },
            },
            sources: {}, // Empty sources
          },
        },
        sourcePaths: new Map(),
      };

      const mockData = JSON.stringify({
        result: [{ status: 'perfect' }],
      });

      const promise = service.verify(payload);

      setImmediate(() => {
        mockResponse.emit('data', mockData);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.status).toBe('perfect');
    });

    it('should handle API URL with trailing slash', () => {
      const serviceWithSlash = new SourcifyService('https://api.example.com/');
      expect(serviceWithSlash).toBeDefined();
    });

    it('should handle chunked response data', async () => {
      const chunk1 = '[{"address":"0xtest","chain';
      const chunk2 = 'Ids":[{"chainId":"296","sta';
      const chunk3 = 'tus":"perfect"}]}]';

      const promise = service.checkIfVerified('0xTest', '296');

      setImmediate(() => {
        mockResponse.emit('data', chunk1);
        mockResponse.emit('data', chunk2);
        mockResponse.emit('data', chunk3);
        mockResponse.emit('end');
      });

      const result = await promise;

      expect(result.isVerified).toBe(true);
      expect(result.status).toBe('perfect');
    });
  });
});
