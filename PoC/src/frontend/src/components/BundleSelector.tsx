import React, { useState, useEffect } from 'react';
import { bundleManager } from '../utils/ApiCache';

interface AnalysisBundle {
  id: string;
  timestamp: number;
  txHash: string;
  transactionData: any;
  debuggerTrace: any;
  contractData: [string, string][];
  description?: string;
}

interface BundleSelectorProps {
  onBundleSelected: (bundle: AnalysisBundle) => void;
  currentBundleId?: string;
}

export const BundleSelector: React.FC<BundleSelectorProps> = ({
  onBundleSelected,
  currentBundleId
}) => {
  const [bundles, setBundles] = useState<AnalysisBundle[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(currentBundleId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const loadBundles = () => {
    const allBundles = bundleManager.getAllBundles();
    setBundles(allBundles);
  };

  useEffect(() => {
    loadBundles();
  }, []);

  const handleBundleSelect = (bundleId: string) => {
    const bundle = bundleManager.loadBundle(bundleId);
    if (bundle) {
      setSelectedBundleId(bundleId);
      onBundleSelected(bundle);
      setIsExpanded(false);
    }
  };

  const handleDeleteBundle = (bundleId: string) => {
    bundleManager.deleteBundle(bundleId);
    loadBundles();
    setShowDeleteConfirm(null);

    // If we deleted the currently selected bundle, clear selection
    if (selectedBundleId === bundleId) {
      setSelectedBundleId(null);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatTxHash = (txHash: string): string => {
    return `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;
  };

  const stats = bundleManager.getBundleStats();

  if (!isExpanded) {
    return (
      <div className="bundle-selector-compact">
        <button
          onClick={() => setIsExpanded(true)}
          className="bundle-toggle-button"
          title="Load cached analysis data"
        >
          📦 Cached Analyses: {stats.count} bundles ({stats.totalSize})
        </button>
        {selectedBundleId && (
          <div className="current-bundle-indicator">
            <span className="bundle-status">
              📋 Loaded: {formatTxHash(bundles.find(b => b.id === selectedBundleId)?.txHash || '')}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bundle-selector-expanded">
      <div className="bundle-header">
        <h4>Load Cached Analysis</h4>
        <button
          onClick={() => setIsExpanded(false)}
          className="bundle-close-button"
        >
          ✕
        </button>
      </div>

      <div className="bundle-info">
        <p>
          Select a previously cached analysis to load all data (transaction details, traces, contract info)
          into the analyzer. Each bundle contains all data retrieved from a single "Analyze with Tenderly" session.
        </p>
      </div>

      {bundles.length === 0 ? (
        <div className="no-bundles">
          <p>No cached analyses found. Run "Analyze with Tenderly" to create your first bundle.</p>
        </div>
      ) : (
        <div className="bundles-list">
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className={`bundle-item ${selectedBundleId === bundle.id ? 'selected' : ''}`}
            >
              <div className="bundle-main-info">
                <div className="bundle-description">
                  <strong>{bundle.description}</strong>
                </div>
                <div className="bundle-details">
                  <span className="bundle-tx">TX: {formatTxHash(bundle.txHash)}</span>
                  <span className="bundle-timestamp">{formatTimestamp(bundle.timestamp)}</span>
                </div>
                <div className="bundle-data-summary">
                  <span className="data-point">
                    {bundle.debuggerTrace?.trace?.length || 0} trace steps
                  </span>
                  <span className="data-point">
                    {bundle.contractData?.length || 0} contracts
                  </span>
                  <span className="data-point">
                    Status: {bundle.transactionData?.simulation?.status || 'unknown'}
                  </span>
                </div>
              </div>

              <div className="bundle-actions">
                <button
                  onClick={() => handleBundleSelect(bundle.id)}
                  className="load-bundle-button"
                  disabled={selectedBundleId === bundle.id}
                >
                  {selectedBundleId === bundle.id ? 'Loaded' : 'Load'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(bundle.id)}
                  className="delete-bundle-button"
                  title="Delete this bundle"
                >
                  🗑️
                </button>
              </div>

              {showDeleteConfirm === bundle.id && (
                <div className="delete-confirm">
                  <p>Delete this analysis bundle?</p>
                  <div className="confirm-actions">
                    <button
                      onClick={() => handleDeleteBundle(bundle.id)}
                      className="confirm-delete"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="cancel-delete"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bundle-actions-footer">
        <button
          onClick={loadBundles}
          className="refresh-bundles-button"
        >
          🔄 Refresh
        </button>
        {bundles.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Delete all cached analysis bundles? This cannot be undone.')) {
                bundleManager.clearAllBundles();
                loadBundles();
                setSelectedBundleId(null);
              }
            }}
            className="clear-all-bundles-button"
          >
            🗑️ Clear All
          </button>
        )}
      </div>
    </div>
  );
};