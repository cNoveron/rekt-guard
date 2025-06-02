import axios from 'axios';
import { contractCache } from '../utils/ApiCache';

interface ContractInfo {
  address: string;
  name: string;
  sourceCode?: string;
  abi?: string;
  contractName?: string;
  compilerVersion?: string;
  isVerified: boolean;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: any;
}

class EtherscanAPI {
  private apiKey: string;
  private baseUrl: string = 'https://api.etherscan.io/api';

  constructor() {
    // Use environment variable or fallback to no key (rate limited)
    this.apiKey = process.env.REACT_APP_ETHERSCAN_API_KEY || '';
  }

  private async makeRequest(params: Record<string, string>): Promise<any> {
    const cacheKey = `etherscan_${JSON.stringify(params)}`;

    // Check cache first
    const cached = contractCache.get(cacheKey);
    if (cached !== null) {
      console.log(`Etherscan cache hit for: ${params.address || params.txhash || 'request'}`);
      return cached;
    }

    try {
      const queryParams = new URLSearchParams({
        ...params,
        ...(this.apiKey && { apikey: this.apiKey })
      });

      console.log(`Etherscan API call for: ${params.address || params.txhash || 'request'}`);
      const response = await axios.get(`${this.baseUrl}?${queryParams.toString()}`);
      const data: EtherscanResponse = response.data;

      if (data.status === '1') {
        // Cache successful responses for 24 hours
        contractCache.set(cacheKey, data.result, 24 * 60 * 60 * 1000);
        return data.result;
      } else {
        console.warn('Etherscan API warning:', data.message);
        return null;
      }
    } catch (error: any) {
      console.error('Etherscan API error:', error);

      // Handle rate limiting
      if (error.response?.status === 429) {
        console.warn('Etherscan API rate limit reached. Consider adding an API key.');
      }

      return null;
    }
  }

  async getContractName(address: string): Promise<string> {
    // Check specific contract name cache first
    const cachedName = contractCache.getCachedContractName(address);
    if (cachedName) {
      console.log(`Contract name cache hit for: ${address}`);
      return cachedName;
    }

    // Check well-known contracts first (no API call needed)
    const wellKnownName = this.getWellKnownContractName(address);
    if (wellKnownName) {
      contractCache.cacheContractName(address, wellKnownName);
      return wellKnownName;
    }

    try {
      const contractInfo = await this.getContractInfo(address);

      if (contractInfo?.isVerified) {
        const name = contractInfo.name || contractInfo.contractName || 'Unknown Contract';
        contractCache.cacheContractName(address, name);
        return name;
      }

      // If not verified, try to get basic info
      const basicInfo = await this.getAddressInfo(address);
      const name = basicInfo?.isContract ? 'Unverified Contract' : 'EOA';
      contractCache.cacheContractName(address, name);
      return name;
    } catch (error) {
      console.error(`Error getting contract name for ${address}:`, error);
      const fallbackName = 'Unknown';
      contractCache.cacheContractName(address, fallbackName);
      return fallbackName;
    }
  }

  async getContractInfo(address: string): Promise<ContractInfo | null> {
    const result = await this.makeRequest({
      module: 'contract',
      action: 'getsourcecode',
      address: address
    });

    if (!result || !Array.isArray(result) || result.length === 0) {
      return null;
    }

    const contractData = result[0];

    return {
      address: address,
      name: contractData.ContractName || 'Unknown',
      sourceCode: contractData.SourceCode,
      abi: contractData.ABI,
      contractName: contractData.ContractName,
      compilerVersion: contractData.CompilerVersion,
      isVerified: contractData.SourceCode !== ''
    };
  }

  async getAddressInfo(address: string): Promise<any> {
    // Check if address is a contract by looking at bytecode
    const result = await this.makeRequest({
      module: 'proxy',
      action: 'eth_getCode',
      address: address,
      tag: 'latest'
    });

    const isContract = result && result !== '0x';

    return {
      address: address,
      isContract: isContract,
      hasCode: isContract
    };
  }

  async getContractABI(address: string): Promise<any[] | null> {
    const result = await this.makeRequest({
      module: 'contract',
      action: 'getabi',
      address: address
    });

    if (result && typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch (error) {
        console.error('Error parsing ABI:', error);
        return null;
      }
    }

    return null;
  }

  async getTransactionDetails(txHash: string): Promise<any> {
    const result = await this.makeRequest({
      module: 'proxy',
      action: 'eth_getTransactionByHash',
      txhash: txHash
    });

    return result;
  }

  async getTransactionReceipt(txHash: string): Promise<any> {
    const result = await this.makeRequest({
      module: 'proxy',
      action: 'eth_getTransactionReceipt',
      txhash: txHash
    });

    return result;
  }

  async getMultipleContractNames(addresses: string[]): Promise<[string, string][]> {
    const promises = addresses.map(async (address): Promise<[string, string]> => {
      const name = await this.getContractName(address);
      return [address, name];
    });

    try {
      const results = await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Error fetching multiple contract names:', error);
      return addresses.map(addr => [addr, 'Error']);
    }
  }

  // Utility method to get well-known contract names
  getWellKnownContractName(address: string): string | null {
    const wellKnownContracts: Record<string, string> = {
      // Common DeFi contracts
      '0xa0b86a33e6441ac8b0f76b2e70c7e615fd5c7c93': 'Penpie Market',
      '0x6e799758cee75dae3d84e09d40dc416eee7a0e1e': 'Penpie Master',
      '0x1a7e4e63778b4f12a199c062f3efdd288afcbce8': 'Euler',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
      '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
      '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
      // Add more as needed
    };

    return wellKnownContracts[address.toLowerCase()] || null;
  }

  // Clear cache if needed
  clearCache(): void {
    contractCache.clear();
  }
}

// Create a singleton instance
export const etherscanAPI = new EtherscanAPI();

// React component for configuration
export const EtherscanConfig: React.FC = () => {
  const hasApiKey = !!process.env.REACT_APP_ETHERSCAN_API_KEY;

  return (
    <div className="etherscan-config">
      {hasApiKey ? (
        <span className="status-indicator connected">✓ Etherscan API configured</span>
      ) : (
        <div className="api-warning">
          <span className="status-indicator warning">⚠ Etherscan API key not configured</span>
          <div className="config-help">
            <p>Add <code>REACT_APP_ETHERSCAN_API_KEY</code> to your .env file for better rate limits.</p>
            <p>Get a free API key at <a href="https://etherscan.io/apis" target="_blank" rel="noopener noreferrer">etherscan.io/apis</a></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default etherscanAPI;