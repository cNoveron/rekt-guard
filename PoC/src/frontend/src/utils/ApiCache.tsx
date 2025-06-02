interface CacheItem {
  data: any;
  timestamp: number;
  expiry: number;
}

interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of items in cache
  keyPrefix: string;
}

class ApiCache {
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 30 * 60 * 1000, // 30 minutes default
      maxSize: 100,
      keyPrefix: 'penpie_cache_',
      ...config
    };
  }

  private getStorageKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private generateKey(url: string, params?: any): string {
    const baseKey = url.replace(/[^a-zA-Z0-9]/g, '_');
    if (params) {
      const paramString = JSON.stringify(params);
      const paramHash = this.simpleHash(paramString);
      return `${baseKey}_${paramHash}`;
    }
    return baseKey;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  set(key: string, data: any, ttl?: number): void {
    try {
      const expiry = Date.now() + (ttl || this.config.defaultTTL);
      const cacheItem: CacheItem = {
        data,
        timestamp: Date.now(),
        expiry
      };

      const storageKey = this.getStorageKey(key);
      localStorage.setItem(storageKey, JSON.stringify(cacheItem));

      // Clean up old entries if cache is getting too large
      this.cleanup();
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  get(key: string): any | null {
    try {
      const storageKey = this.getStorageKey(key);
      const cached = localStorage.getItem(storageKey);

      if (!cached) {
        return null;
      }

      const cacheItem: CacheItem = JSON.parse(cached);

      // Check if expired
      if (Date.now() > cacheItem.expiry) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      return null;
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    const storageKey = this.getStorageKey(key);
    localStorage.removeItem(storageKey);
  }

  clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.config.keyPrefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  cleanup(): void {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(this.config.keyPrefix));

    // Remove expired items
    cacheKeys.forEach(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const cacheItem: CacheItem = JSON.parse(cached);
          if (Date.now() > cacheItem.expiry) {
            localStorage.removeItem(key);
          }
        }
      } catch (error) {
        // Remove corrupted cache items
        localStorage.removeItem(key);
      }
    });

    // If still too many items, remove oldest ones
    const remainingKeys = Object.keys(localStorage)
      .filter(key => key.startsWith(this.config.keyPrefix));

    if (remainingKeys.length > this.config.maxSize) {
      const itemsWithTimestamp = remainingKeys.map(key => {
        try {
          const cached = localStorage.getItem(key);
          const cacheItem: CacheItem = cached ? JSON.parse(cached) : null;
          return {
            key,
            timestamp: cacheItem?.timestamp || 0
          };
        } catch {
          return { key, timestamp: 0 };
        }
      });

      // Sort by timestamp and remove oldest
      itemsWithTimestamp
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, remainingKeys.length - this.config.maxSize)
        .forEach(item => localStorage.removeItem(item.key));
    }
  }

  getStats(): { size: number; totalSize: string; oldestItem: string | null } {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(this.config.keyPrefix));

    let totalBytes = 0;
    let oldestTimestamp = Date.now();
    let oldestKey = null;

    cacheKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalBytes += value.length;
        try {
          const cacheItem: CacheItem = JSON.parse(value);
          if (cacheItem.timestamp < oldestTimestamp) {
            oldestTimestamp = cacheItem.timestamp;
            oldestKey = key;
          }
        } catch {
          // Ignore corrupted items
        }
      }
    });

    return {
      size: cacheKeys.length,
      totalSize: `${(totalBytes / 1024).toFixed(2)} KB`,
      oldestItem: oldestKey ? new Date(oldestTimestamp).toLocaleString() : null
    };
  }

  // Wrapper method for API calls with caching
  async cachedApiCall<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`);
      return cached;
    }

    // Make API call
    console.log(`Cache miss for key: ${key}, making API call`);
    try {
      const result = await apiCall();
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      console.error(`API call failed for key: ${key}`, error);
      throw error;
    }
  }

  // Specific cache methods for different API types
  cacheContractName(address: string, name: string): void {
    this.set(`contract_name_${address.toLowerCase()}`, name, 24 * 60 * 60 * 1000); // 24 hours
  }

  getCachedContractName(address: string): string | null {
    return this.get(`contract_name_${address.toLowerCase()}`);
  }

  cacheTransactionTrace(txHash: string, trace: any): void {
    this.set(`tx_trace_${txHash.toLowerCase()}`, trace, 7 * 24 * 60 * 60 * 1000); // 7 days
  }

  getCachedTransactionTrace(txHash: string): any | null {
    return this.get(`tx_trace_${txHash.toLowerCase()}`);
  }

  cacheSimulationResult(txHash: string, result: any): void {
    this.set(`simulation_${txHash.toLowerCase()}`, result, 60 * 60 * 1000); // 1 hour
  }

  getCachedSimulationResult(txHash: string): any | null {
    return this.get(`simulation_${txHash.toLowerCase()}`);
  }
}

// Create singleton instances for different cache types
export const contractCache = new ApiCache({
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours for contract data
  maxSize: 200,
  keyPrefix: 'contract_cache_'
});

export const transactionCache = new ApiCache({
  defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days for transaction data
  maxSize: 50,
  keyPrefix: 'tx_cache_'
});

export const simulationCache = new ApiCache({
  defaultTTL: 60 * 60 * 1000, // 1 hour for simulation data
  maxSize: 20,
  keyPrefix: 'sim_cache_'
});

// Bundle management for complete analysis sessions
interface AnalysisBundle {
  id: string;
  timestamp: number;
  txHash: string;
  transactionData: any;
  debuggerTrace: any;
  contractData: [string, string][];
  functionSignatures?: { [key: string]: string }; // Serializable version of Map
  foundryContractCalls?: any[]; // Foundry contract calls data
  description?: string;
}

class BundleManager {
  private keyPrefix = 'analysis_bundle_';

  saveBundleData(
    txHash: string,
    transactionData: any,
    debuggerTrace: any,
    contractData: [string, string][],
    description?: string,
    functionSignatures?: Map<string, string>,
    foundryContractCalls?: any[]
  ): string {
    const bundleId = `${txHash}_${Date.now()}`;

    // Convert Map to plain object for serialization
    const functionSigObject = functionSignatures ?
      Object.fromEntries(functionSignatures.entries()) : undefined;

    const bundle: AnalysisBundle = {
      id: bundleId,
      timestamp: Date.now(),
      txHash,
      transactionData,
      debuggerTrace,
      contractData,
      functionSignatures: functionSigObject,
      foundryContractCalls,
      description: description || `Analysis of ${txHash.slice(0, 10)}...`
    };

    try {
      localStorage.setItem(`${this.keyPrefix}${bundleId}`, JSON.stringify(bundle));
      console.log(`Analysis bundle saved: ${bundleId}`);
      return bundleId;
    } catch (error) {
      console.error('Failed to save analysis bundle:', error);
      throw error;
    }
  }

  loadBundle(bundleId: string): AnalysisBundle | null {
    try {
      const bundleData = localStorage.getItem(`${this.keyPrefix}${bundleId}`);
      if (!bundleData) {
        return null;
      }
      const bundle = JSON.parse(bundleData);

      // Convert function signatures object back to Map if it exists
      if (bundle.functionSignatures) {
        bundle.functionSignatures = new Map(Object.entries(bundle.functionSignatures));
      }

      // Ensure foundryContractCalls is available (for backward compatibility)
      if (!bundle.foundryContractCalls) {
        bundle.foundryContractCalls = [];
      }

      return bundle;
    } catch (error) {
      console.error('Failed to load analysis bundle:', error);
      return null;
    }
  }

  getAllBundles(): AnalysisBundle[] {
    const bundles: AnalysisBundle[] = [];
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(this.keyPrefix)) {
        try {
          const bundleData = localStorage.getItem(key);
          if (bundleData) {
            const bundle = JSON.parse(bundleData);
            bundles.push(bundle);
          }
        } catch (error) {
          console.warn(`Failed to parse bundle: ${key}`, error);
        }
      }
    });

    // Sort by timestamp (newest first)
    return bundles.sort((a, b) => b.timestamp - a.timestamp);
  }

  deleteBundle(bundleId: string): void {
    localStorage.removeItem(`${this.keyPrefix}${bundleId}`);
    console.log(`Analysis bundle deleted: ${bundleId}`);
  }

  clearAllBundles(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.keyPrefix)) {
        localStorage.removeItem(key);
      }
    });
    console.log('All analysis bundles cleared');
  }

  getBundleStats(): { count: number; totalSize: string } {
    const keys = Object.keys(localStorage);
    const bundleKeys = keys.filter(key => key.startsWith(this.keyPrefix));

    let totalBytes = 0;
    bundleKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalBytes += value.length;
      }
    });

    return {
      count: bundleKeys.length,
      totalSize: `${(totalBytes / 1024).toFixed(2)} KB`
    };
  }
}

export const bundleManager = new BundleManager();

export default ApiCache;