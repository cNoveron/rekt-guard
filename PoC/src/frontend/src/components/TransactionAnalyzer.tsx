import React, { useState, useEffect, useCallback } from 'react';
import { tenderlyAPI } from './TenderlyDebugger';
import { etherscanAPI } from './EtherscanAPI';
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

interface TransactionAnalyzerProps {
  txHash: string;
  onTransactionData: (data: any) => void;
  onDebuggerTrace: (trace: any) => void;
  loadedBundle?: AnalysisBundle | null;
  onBundleSaved?: (bundleId: string) => void;
}

export const TransactionAnalyzer: React.FC<TransactionAnalyzerProps> = ({
  txHash,
  onTransactionData,
  onDebuggerTrace,
  loadedBundle,
  onBundleSaved
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugTxResponse, setDebugTxResponse] = useState<any>(null);
  const [addresses, setAddresses] = useState<string[]| null>(null);
  const [traceData, setTraceData] = useState<any>(null);
  const [basicContractData, setBasicContractData] = useState<[string, string][]>([]);
  const [contractDataLoading, setContractDataLoading] = useState(false);
  const [currentBundleId, setCurrentBundleId] = useState<string | null>(null);
  const [bundleSaving, setBundleSaving] = useState(false);

  // Load bundle data when a bundle is provided
  useEffect(() => {
    if (loadedBundle) {
      console.log('Loading bundle data:', loadedBundle.id);
      setDebugTxResponse(loadedBundle.transactionData);
      setTraceData(loadedBundle.debuggerTrace);
      setBasicContractData(loadedBundle.contractData);
      setCurrentBundleId(loadedBundle.id);

      // Extract addresses from transaction data
      if (loadedBundle.transactionData?.simulation?.addresses) {
        setAddresses(loadedBundle.transactionData.simulation.addresses);
      }

      // Notify parent components
      onTransactionData(loadedBundle.transactionData);
      onDebuggerTrace(loadedBundle.debuggerTrace);

      setError(null);
    }
  }, [loadedBundle, onTransactionData, onDebuggerTrace]);

  const saveCurrentAnalysisAsBundle = async () => {
    if (!debugTxResponse || !traceData) {
      console.warn('No analysis data to save');
      return;
    }

    setBundleSaving(true);
    try {
      const description = `Analysis of ${txHash.slice(0, 10)}... - ${new Date().toLocaleString()}`;
      const bundleId = bundleManager.saveBundleData(
        txHash,
        debugTxResponse,
        traceData,
        basicContractData,
        description
      );

      setCurrentBundleId(bundleId);
      onBundleSaved?.(bundleId);
      console.log('Analysis bundle saved successfully:', bundleId);
    } catch (error) {
      console.error('Failed to save analysis bundle:', error);
    } finally {
      setBundleSaving(false);
    }
  };

  const analyzeTransaction = async () => {
    setLoading(true);
    setError(null);
    setCurrentBundleId(null); // Clear any loaded bundle when doing fresh analysis

    try {
      // First, simulate the transaction
      console.log('Simulating transaction:', txHash);
      const debugTx_response = await tenderlyAPI.debugTransaction(txHash);
      console.log('Simulation:', debugTx_response);

      setDebugTxResponse(debugTx_response);
      onTransactionData(debugTx_response);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze transaction');
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTraceData = useCallback(async () => {
    const trace = await tenderlyAPI.getTransactionTrace(debugTxResponse.simulation.id)
    setTraceData(trace);
    onDebuggerTrace(trace);
  }, [debugTxResponse?.simulation?.id, onDebuggerTrace]);

  useEffect(() => {
    if (!debugTxResponse) return
    let { simulation } = debugTxResponse;
    if (!simulation) return
    if (simulation?.id) {
      console.log('Fetching trace for simulation:', debugTxResponse.simulation.id);
      getTraceData()
    }
    if (simulation?.addresses && simulation?.addresses?.length > 0) {
      let { addresses } = simulation;
      if (addresses.length > 0) setAddresses(addresses)
    }
  }, [debugTxResponse, getTraceData]);

  const fetchContractNames = useCallback(async (addressList: string[]) => {
    setContractDataLoading(true);
    try {
      const contractNames = await etherscanAPI.getMultipleContractNames(addressList);
      console.log('Contract names:', contractNames);
      setBasicContractData(contractNames);
    } catch (error) {
      console.error('Error fetching contract names:', error);
    } finally {
      setContractDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!addresses || addresses.length === 0) return;
    // Only fetch contract names if we don't already have them (from loaded bundle)
    if (basicContractData.length === 0) {
      fetchContractNames(addresses);
    }
  }, [addresses, fetchContractNames, basicContractData.length]);

  // Auto-save bundle when analysis is complete
  useEffect(() => {
    if (debugTxResponse && traceData && basicContractData.length > 0 && !currentBundleId && !loadedBundle) {
      // Only auto-save if this is a fresh analysis (not a loaded bundle)
      saveCurrentAnalysisAsBundle();
    }
  }, [debugTxResponse, traceData, basicContractData, currentBundleId, loadedBundle]);

  const formatValue = (value: string | number, decimals: number = 18): string => {
    if (value === '0x') {
      return '0';
    }
    if (typeof value === 'string' && value.startsWith('0x')) {
      const bigIntValue = BigInt(value);
      const divisor = BigInt(10 ** decimals);
      const integerPart = bigIntValue / divisor;
      const fractionalPart = bigIntValue % divisor;

      if (fractionalPart === 0n) {
        return integerPart.toString();
      }

      const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
      const trimmedFractional = fractionalStr.replace(/0+$/, '');

      if (trimmedFractional === '') {
        return integerPart.toString();
      }

      return `${integerPart}.${trimmedFractional}`;
    }

    return value.toString();
  };

  const getContractName = (address: string): string => {
    const contractData = basicContractData.find(([addr, _]) => addr.toLowerCase() === address.toLowerCase());
    return contractData ? contractData[1] : 'Unknown';
  };

  const renderCallTree = (traceData: any, contractData: [string, string][], depth: number = 0): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];

    if (!traceData) return rows;

    // Handle single call object or array of calls
    const calls = Array.isArray(traceData) ? traceData : [traceData];

    calls.forEach((call, index) => {
      const indentChars = '│  '.repeat(depth);
      const branchChar = index === calls.length - 1 ? '└─ ' : '├─ ';
      const hierarchy = depth === 0 ? '' : `${indentChars}${branchChar}`;

      const contractName = call.to ? getContractName(call.to) : 'Unknown';
      const functionName = call.input && call.input.length > 10
        ? `0x${call.input.slice(2, 10)}...`
        : call.input || 'Unknown';
      const gasUsed = call.gasUsed ? parseInt(call.gasUsed, 16) : 0;
      const value = call.value ? parseInt(call.value, 16) : 0;

      rows.push(
        <tr key={`${depth}-${index}`} className={`call-tree-row depth-${depth}`}>
          <td className="hierarchy-cell">
            <span className="hierarchy-text">{hierarchy}</span>
            <span className="call-type">{call.type || 'CALL'}</span>
          </td>
          <td className="contract-cell">
            <div className="contract-info">
              <code className="address">{call.to || 'N/A'}</code>
              <span className="contract-name">{contractName}</span>
            </div>
          </td>
          <td className="function-cell">
            <div className="function-info">
            <span className="function-name">{functionName}</span>
              {call.from && (
                <div className="from-address">
                  <small>from: {call.from.slice(0, 8)}...</small>
                </div>
              )}
            </div>
          </td>
          <td className="gas-cell">
            <span className="gas-amount">{gasUsed.toLocaleString()}</span>
          </td>
          <td className="value-cell">
            <span className="value-amount">{formatValue(value.toString())} ETH</span>
          </td>
        </tr>
      );

      // Recursively render subcalls
      if (call.calls && call.calls.length > 0) {
        rows.push(...renderCallTree(call.calls, contractData, depth + 1));
      }
    });

    return rows;
  };

  const countTotalCalls = (trace: any): number => {
    if (!trace) return 0;

    let count = 1; // Count the current call
    if (trace.calls && Array.isArray(trace.calls)) {
      count += trace.calls.reduce((total: number, call: any) => total + countTotalCalls(call), 0);
    }
    return count;
  };

  const getMaxDepth = (trace: any, depth: number = 0): number => {
    if (!trace) return depth;

    let maxDepth = depth;
    if (trace.calls && Array.isArray(trace.calls)) {
      maxDepth = Math.max(maxDepth, ...trace.calls.map((call: any) => getMaxDepth(call, depth + 1)));
    }
    return maxDepth;
  };

  return (
    <div className="transaction-analyzer">
      <div className="analyzer-header">
        <h2>Transaction Analysis</h2>
        <div className="analyzer-actions">
          <button
            onClick={analyzeTransaction}
            disabled={loading}
            className="analyze-button"
          >
            {loading ? 'Analyzing...' : 'Analyze with Tenderly'}
          </button>

          {(debugTxResponse && traceData) && (
            <button
              onClick={saveCurrentAnalysisAsBundle}
              disabled={bundleSaving}
              className="save-bundle-button"
              title="Save current analysis as a bundle"
            >
              {bundleSaving ? 'Saving...' : '💾 Save Bundle'}
            </button>
          )}
        </div>

        {currentBundleId && (
          <div className="bundle-status">
            <span className="bundle-indicator">
              📦 {loadedBundle ? 'Loaded from bundle' : 'Saved as bundle'}: {currentBundleId.split('_')[0].slice(0, 10)}...
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <details>
            <summary>Troubleshooting</summary>
            <ul>
              <li>Make sure Tenderly is configured correctly</li>
              <li>Check that your API key has the required permissions</li>
              <li>Verify the transaction hash is correct</li>
              <li>Ensure you have sufficient Tenderly credits</li>
            </ul>
          </details>
        </div>
      )}

      {debugTxResponse?.simulation && (
        <div className="simulation-results">
          <h3>Simulation Results</h3>

          <div className="simulation-overview">
            <div className="result-card">
              <h4>Status</h4>
              <span className={`status ${debugTxResponse.simulation?.status || 'unknown'}`}>
                {debugTxResponse.simulation?.status || 'Unknown'}
              </span>
            </div>

            <div className="result-card">
              <h4>Gas Used</h4>
              <p>{debugTxResponse.transaction?.gas_used?.toLocaleString() || 'N/A'}</p>
            </div>

            <div className="result-card">
              <h4>Gas Limit</h4>
              <p>{debugTxResponse.transaction?.gas_limit?.toLocaleString() || 'N/A'}</p>
            </div>

            <div className="result-card">
              <h4>Block Number</h4>
              <p>{debugTxResponse.transaction?.block_number?.toLocaleString() || 'N/A'}</p>
            </div>
          </div>

          {debugTxResponse.transaction?.value && (
            <div className="transaction-value">
              <h4>Transaction Value</h4>
              <p>{formatValue(debugTxResponse.transaction.value)} ETH</p>
            </div>
          )}

          {traceData && traceData.trace && (
            <div className="call-tree-section">
              <h4>Transaction Call Tree</h4>
              <div className="call-tree-container">
                <table className="call-tree-table">
                  <thead>
                    <tr>
                      <th>Call Hierarchy</th>
                      <th>Contract</th>
                      <th>Function</th>
                      <th>Gas Used</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderCallTree(traceData.trace, basicContractData)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {addresses && addresses.length > 0 && (
            <div className="contracts-summary">
              <h4>Contracts Summary</h4>
              {contractDataLoading && (
                <p className="loading-indicator">Loading contract names...</p>
              )}
              <div className="contracts-grid">
                {addresses.map((address: string, index: number) => {
                  // Find the contract name from basicContractData
                  const contractData = basicContractData.find(([addr, _]) => addr.toLowerCase() === address.toLowerCase());
                  const contractName = contractData ? contractData[1] : 'Loading...';

                  return (
                    <div key={index} className="contract-summary-item">
                      <div className="contract-address">
                        <code>{address}</code>
                      </div>
                      <div className="contract-name">
                        <span className={`contract-name-value ${contractName === 'Loading...' ? 'loading' : ''}`}>
                          {contractName}
                        </span>
                      </div>
                      {contractName === 'EOA' && (
                        <div className="contract-type">
                          <em>Externally Owned Account</em>
                        </div>
                      )}
                      {contractName === 'Unverified Contract' && (
                        <div className="contract-type">
                          <em>Contract not verified on Etherscan</em>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {debugTxResponse.generated_access_list && (
            <div className="access-list">
              <h4>Access List</h4>
              <pre>{JSON.stringify(debugTxResponse.generated_access_list, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {traceData && (
        <div className="trace-summary">
          <h3>Execution Trace Summary</h3>
          <div className="trace-stats">
            <div className="stat-item">
              <strong>Total Steps:</strong> {Array.isArray(traceData.trace) ? traceData.trace.length : 0}
            </div>
            <div className="stat-item">
              <strong>Call Depth:</strong> {Array.isArray(traceData.trace) && traceData.trace.length > 0
                ? Math.max(...traceData.trace.map((step: any) => step.depth || 0))
                : 0}
            </div>
            <div className="stat-item">
              <strong>Opcodes Used:</strong> {Array.isArray(traceData.trace) && traceData.trace.length > 0
                ? new Set(traceData.trace.map((step: any) => step.op || 'UNKNOWN')).size
                : 0}
            </div>
          </div>

          <p>Use the "Attack Steps" tab to explore the execution step-by-step.</p>
        </div>
      )}

      <div className="analyzer-info">
        <h4>About This Analysis</h4>
        <p>
          This tool uses Tenderly's debugging API to provide detailed insights into the Penpie hack transaction.
          The analysis includes execution traces, memory states, calldata, and return data for each step of the attack.
        </p>
        <ul>
          <li><strong>Simulation:</strong> Re-executes the transaction in a safe environment</li>
          <li><strong>Trace:</strong> Captures every opcode execution and state change</li>
          <li><strong>Memory:</strong> Shows memory contents at each step</li>
          <li><strong>Calldata:</strong> Displays function call parameters</li>
          <li><strong>Return Data:</strong> Shows function return values</li>
        </ul>
      </div>
    </div>
  );
};