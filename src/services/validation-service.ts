export interface ParsedContract {
    contractPath: string;
    contractName: string;
  }
  
  export class ValidationService {
    private static readonly ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
    private static readonly CONTRACT_FORMAT_REGEX = /^(.+):(.+)$/;
  
    validateInput(address: string, contract: string): string | null {
      // Validate address format
      if (!address || !ValidationService.ADDRESS_REGEX.test(address)) {
        return (
          "Error: Invalid contract address format. " +
          "Expected format: 0x followed by 40 hexadecimal characters."
        );
      }
  
      // Validate contract parameter
      if (!contract) {
        return (
          "Error: Contract parameter is required. " +
          "Format: path/to/Contract.sol:ContractName"
        );
      }
  
      // Validate contract format
      if (!ValidationService.CONTRACT_FORMAT_REGEX.test(contract)) {
        return (
          "Error: Invalid contract format. " +
          "Expected format: path/to/Contract.sol:ContractName"
        );
      }
  
      return null; // No errors
    }
  
    parseContract(contract: string): ParsedContract {
      const match = contract.match(ValidationService.CONTRACT_FORMAT_REGEX);
      
      if (!match) {
        throw new Error(
          "Invalid contract format. Expected format: path/to/Contract.sol:ContractName"
        );
      }
  
      const [, contractPath, contractName] = match;
      
      return {
        contractPath,
        contractName,
      };
    }
  
    isValidChainId(chainId: number | undefined): chainId is number {
      return chainId !== undefined && chainId !== null && !isNaN(chainId);
    }
  }
