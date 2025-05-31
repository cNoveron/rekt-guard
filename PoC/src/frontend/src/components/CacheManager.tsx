import React, { useState, useEffect } from 'react';
import { contractCache, transactionCache, simulationCache } from '../utils/ApiCache';

interface CacheStats {
  size: number;
  totalSize: string;
  oldestItem: string | null;
}

export const CacheManager: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<{
    contract: CacheStats;
    transaction: CacheStats;
    simulation: CacheStats;
  }>({
    contract: { size: 0, totalSize: '0 KB', oldestItem: null },
    transaction: { size: 0, totalSize: '0 KB', oldestItem: null },
    simulation: { size: 0, totalSize: '0 KB', oldestItem: null }
  });

  const updateStats = () => {
    setStats({
      contract: contractCache.getStats(),
      transaction: transactionCache.getStats(),
      simulation: simulationCache.getStats()
    });
  };

  useEffect(() => {
    updateStats();
    // Update stats every 30 seconds
    const interval = setInterval(updateStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const clearAllCaches = () => {
    contractCache.clear();
    transactionCache.clear();
    simulationCache.clear();
    updateStats();
    console.log('All caches cleared');
  };

  const clearSpecificCache = (cacheType: 'contract' | 'transaction' | 'simulation') => {
    switch (cacheType) {
      case 'contract':
        contractCache.clear();
        break;
      case 'transaction':
        transactionCache.clear();
        break;
      case 'simulation':
        simulationCache.clear();
        break;
    }
    updateStats();
    console.log(`${cacheType} cache cleared`);
  };

  const cleanupCaches = () => {
    contractCache.cleanup();
    transactionCache.cleanup();
    simulationCache.cleanup();
    updateStats();
    console.log('Cache cleanup completed');
  };

  const totalItems = stats.contract.size + stats.transaction.size + stats.simulation.size;
  const totalSizeKB = parseFloat(stats.contract.totalSize) +
                     parseFloat(stats.transaction.totalSize) +
                     parseFloat(stats.simulation.totalSize);

  if (!isExpanded) {
    return (
      <div className="cache-manager-compact">
        <button
          onClick={() => setIsExpanded(true)}
          className="cache-toggle-button"
          title="Show cache statistics"
        >
          📊 Cache: {totalItems} items ({totalSizeKB.toFixed(2)} KB)
        </button>
      </div>
    );
  }

  return (
    <div className="cache-manager-expanded">
      <div className="cache-header">
        <h4>Cache Management</h4>
        <button
          onClick={() => setIsExpanded(false)}
          className="cache-close-button"
        >
          ✕
        </button>
      </div>

      <div className="cache-stats-grid">
        <div className="cache-stat-card">
          <h5>Contract Data</h5>
          <div className="stat-details">
            <span className="stat-number">{stats.contract.size}</span>
            <span className="stat-label">items</span>
          </div>
          <div className="stat-size">{stats.contract.totalSize}</div>
          <button
            onClick={() => clearSpecificCache('contract')}
            className="clear-button"
            disabled={stats.contract.size === 0}
          >
            Clear
          </button>
        </div>

        <div className="cache-stat-card">
          <h5>Transaction Data</h5>
          <div className="stat-details">
            <span className="stat-number">{stats.transaction.size}</span>
            <span className="stat-label">items</span>
          </div>
          <div className="stat-size">{stats.transaction.totalSize}</div>
          <button
            onClick={() => clearSpecificCache('transaction')}
            className="clear-button"
            disabled={stats.transaction.size === 0}
          >
            Clear
          </button>
        </div>

        <div className="cache-stat-card">
          <h5>Simulation Data</h5>
          <div className="stat-details">
            <span className="stat-number">{stats.simulation.size}</span>
            <span className="stat-label">items</span>
          </div>
          <div className="stat-size">{stats.simulation.totalSize}</div>
          <button
            onClick={() => clearSpecificCache('simulation')}
            className="clear-button"
            disabled={stats.simulation.size === 0}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="cache-actions">
        <button
          onClick={cleanupCaches}
          className="cleanup-button"
          title="Remove expired items and optimize cache"
        >
          🧹 Cleanup
        </button>
        <button
          onClick={clearAllCaches}
          className="clear-all-button"
          disabled={totalItems === 0}
        >
          🗑️ Clear All
        </button>
        <button
          onClick={updateStats}
          className="refresh-button"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="cache-info">
        <p className="cache-description">
          Cache stores API responses locally to reduce network requests and improve performance.
          Contract data is cached for 24 hours, transaction data for 7 days.
        </p>
        {totalItems > 0 && (
          <div className="cache-summary">
            <strong>Total:</strong> {totalItems} items, {totalSizeKB.toFixed(2)} KB
          </div>
        )}
      </div>
    </div>
  );
};