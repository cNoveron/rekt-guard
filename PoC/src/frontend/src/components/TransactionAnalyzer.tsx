import React, { useState, useEffect, useCallback } from 'react';
import { tenderlyAPI } from './TenderlyDebugger';
import { etherscanAPI } from './EtherscanAPI';
import { bundleManager } from '../utils/ApiCache';
import { FoundryService } from './FoundryService';
import webacyMockResponse from '../assets/webacy-response.json';

interface AnalysisBundle {
  id: string;
  timestamp: number;
  txHash: string;
  transactionData: any;
  debuggerTrace: any;
  contractData: [string, string][];
  functionSignatures?: Map<string, string>;
  foundryContractCalls?: any[];
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
  const [functionSignatures, setFunctionSignatures] = useState<Map<string, string>>(new Map());
  const [foundryContractCalls, setFoundryContractCalls] = useState<any[]>([]);
  const [riskAnalysisPopup, setRiskAnalysisPopup] = useState<{
    isOpen: boolean;
    address: string;
    position: { x: number; y: number };
    loading: boolean;
    data: any;
    error: string | null;
  }>({
    isOpen: false,
    address: '',
    position: { x: 0, y: 0 },
    loading: false,
    data: null,
    error: null
  });

  // Load bundle data when a bundle is provided
  useEffect(() => {
    if (loadedBundle) {
      console.log('Loading bundle data:', loadedBundle.id);
      setDebugTxResponse(loadedBundle.transactionData);
      setTraceData(loadedBundle.debuggerTrace);
      setBasicContractData(loadedBundle.contractData);
      setCurrentBundleId(loadedBundle.id);

      // Load function signatures if available
      if (loadedBundle.functionSignatures) {
        setFunctionSignatures(loadedBundle.functionSignatures);
      }

      // Load foundry contract calls if available
      if (loadedBundle.foundryContractCalls) {
        setFoundryContractCalls(loadedBundle.foundryContractCalls);
      }

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
        description,
        functionSignatures,
        foundryContractCalls
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
    setFunctionSignatures(new Map()); // Clear function signatures
    setFoundryContractCalls([]); // Clear foundry contract calls

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

  const handleFoundryFunctionSignatures = (signatures: Map<string, string>) => {
    console.log('Foundry resolved function signatures:', signatures);
    setFunctionSignatures(signatures);
  };

  const handleFoundryContractCalls = (contractCalls: any[]) => {
    setFoundryContractCalls(contractCalls);
  };

  const handleAddressClick = (address: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setRiskAnalysisPopup({
      isOpen: true,
      address,
      position: { x: rect.left + rect.width / 2, y: rect.bottom + 10 },
      loading: false,
      data: null,
      error: null
    });
  };

  const closeRiskAnalysisPopup = () => {
    setRiskAnalysisPopup(prev => ({ ...prev, isOpen: false }));
  };

  const analyzeContractRisk = async () => {
    if (!riskAnalysisPopup.address) return;

    setRiskAnalysisPopup(prev => ({ ...prev, loading: true, error: null, data: null }));

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Use imported mock response instead of actual API call due to CORS
      const mockData = {
        ...webacyMockResponse,
        address: riskAnalysisPopup.address
      };

      setRiskAnalysisPopup(prev => ({
        ...prev,
        loading: false,
        data: mockData,
        error: null
      }));
    } catch (error) {
      setRiskAnalysisPopup(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to analyze contract risk',
        data: null
      }));
    }
  };

  const formatValue = (value: string | number, decimals: number = 18): string => {
    if (!value || value === '0x' || value === '0x0') {
      return '0';
    }
    if (typeof value === 'string' && value.startsWith('0x')) {
      try {
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
      } catch (error) {
        console.warn('Error formatting value:', value, error);
        return '0';
      }
    }

    return value.toString();
  };

  const getContractName = (address: string): string => {
    const contractData = basicContractData.find(([addr, _]) => addr.toLowerCase() === address.toLowerCase());
    return contractData ? contractData[1] : 'Unknown';
  };

  const getFunctionName = (input: string): string => {
    if (!input || input.length < 10) {
      return input || 'Unknown';
    }

    // Extract the 4-byte function selector
    const selector = input.slice(0, 10); // 0x + 8 hex chars

    // Check if we have a resolved function name from Foundry
    const resolvedName = functionSignatures.get(selector);
    if (resolvedName) {
      return resolvedName;
    }

    // Fallback to showing the hex selector
    return `${selector}...`;
  };

  const getDecodedParams = (input: string, contractAddress: string, callType: string): string => {
    if (!foundryContractCalls.length) {
      return 'No Foundry data';
    }

    // Extract the function selector from the input
    if (!input || input.length < 10) {
      return 'Invalid input data';
    }

    const selector = input.slice(0, 10); // 0x + 8 hex chars

    // Find a matching contract call by both address and selector
    const matchingCall = foundryContractCalls.find(call =>
      call.address.toLowerCase() === contractAddress.toLowerCase() &&
      call.selector === selector
    );

    if (matchingCall && matchingCall.params) {
      return matchingCall.params;
    }

    // If no exact match, try to find by selector only (in case address matching fails)
    const selectorMatch = foundryContractCalls.find(call => call.selector === selector);
    if (selectorMatch && selectorMatch.params) {
      return `${selectorMatch.params} (selector match)`;
    }

    return 'No matching parameters found';
  };

  const renderCallTree = (traceData: any, contractData: [string, string][]): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];

    // Debug: Log the trace data structure
    console.log('renderCallTree called with:', traceData);

    if (!traceData) {
      console.log('No trace data');
      return rows;
    }

    // Handle different trace data structures
    let traces = [];
    if (Array.isArray(traceData)) {
      traces = traceData;
    } else if (traceData.trace && Array.isArray(traceData.trace)) {
      traces = traceData.trace;
    } else if (traceData.trace) {
      traces = [traceData.trace];
    } else {
      traces = [traceData];
    }

    console.log('Processing traces:', traces);

    traces.forEach((step: any, index: number) => {
      console.log('Processing step:', step);

      const contractName = step.to ? getContractName(step.to) : 'Unknown';
      const functionName = getFunctionName(step.input);
      const decodedParams = getDecodedParams(step.input, step.to || '', step.type || '');

      // Determine if this function was resolved by Foundry
      const isResolved = step.input && step.input.length >= 10 &&
                        functionSignatures.has(step.input.slice(0, 10));

      rows.push(
        <tr key={index} className="call-tree-row depth-0">
          <td className="hierarchy-cell">
            <span className="hierarchy-text"></span>
            <span className="call-type">{step.type || 'CALL'}</span>
          </td>
          <td className="contract-cell">
            <div className="contract-info">
              <code
                className="address clickable-address"
                onClick={(e) => handleAddressClick(step.to || '', e)}
                title="Click to analyze contract risk"
              >
                {step.to ? `${step.to.slice(0, 8)}...` : 'N/A'}
              </code>
              <span className="contract-name">{contractName}</span>
            </div>
          </td>
          <td className="contract-cell">
            <div className="contract-info">
              <code
                className="address clickable-address"
                onClick={(e) => handleAddressClick(step.from || '', e)}
                title="Click to analyze contract risk"
              >
                {step.from ? `${step.from.slice(0, 8)}...` : 'N/A'}
              </code>
              <span className="contract-name">{step.from ? getContractName(step.from) : 'Unknown'}</span>
            </div>
          </td>
          <td className="function-cell">
            <div className="function-info">
              <span className={`function-name ${isResolved ? 'resolved' : 'unresolved'}`}>
                {functionName}
              </span>
              {isResolved && (
                <span className="resolved-indicator" title="Function name resolved by Foundry">
                  🔨
                </span>
              )}
            </div>
          </td>
          <td className="params-cell">
            <div className="params-info">
              <code className="params-data">{decodedParams}</code>
            </div>
          </td>
        </tr>
      );

      // Recursively render subcalls if they exist
      if (step.calls && Array.isArray(step.calls) && step.calls.length > 0) {
        rows.push(...renderSubCalls(step.calls, contractData, 1));
      }
    });

    console.log('Generated rows:', rows.length);
    return rows;
  };

  const renderSubCalls = (calls: any[], contractData: [string, string][], depth: number): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];

    calls.forEach((call, index) => {
      const indentChars = '│  '.repeat(depth);
      const branchChar = index === calls.length - 1 ? '└─ ' : '├─ ';
      const hierarchy = `${indentChars}${branchChar}`;

      const contractName = call.to ? getContractName(call.to) : 'Unknown';
      const functionName = getFunctionName(call.input);
      const decodedParams = getDecodedParams(call.input, call.to || '', call.type || '');

      // Determine if this function was resolved by Foundry
      const isResolved = call.input && call.input.length >= 10 &&
                        functionSignatures.has(call.input.slice(0, 10));

      rows.push(
        <tr key={`${depth}-${index}`} className={`call-tree-row depth-${depth}`}>
          <td className="hierarchy-cell">
            <span className="hierarchy-text">{hierarchy}</span>
            <span className="call-type">{call.type || 'CALL'}</span>
          </td>
          <td className="contract-cell">
            <div className="contract-info">
              <code
                className="address clickable-address"
                onClick={(e) => handleAddressClick(call.to || '', e)}
                title="Click to analyze contract risk"
              >
                {call.to ? `${call.to.slice(0, 8)}...` : 'N/A'}
              </code>
              <span className="contract-name">{contractName}</span>
            </div>
          </td>
          <td className="contract-cell">
            <div className="contract-info">
              <code
                className="address clickable-address"
                onClick={(e) => handleAddressClick(call.from || '', e)}
                title="Click to analyze contract risk"
              >
                {call.from ? `${call.from.slice(0, 8)}...` : 'N/A'}
              </code>
              <span className="contract-name">{call.from ? getContractName(call.from) : 'Unknown'}</span>
            </div>
          </td>
          <td className="function-cell">
            <div className="function-info">
              <span className={`function-name ${isResolved ? 'resolved' : 'unresolved'}`}>
                {functionName}
              </span>
              {isResolved && (
                <span className="resolved-indicator" title="Function name resolved by Foundry">
                  🔨
                </span>
              )}
            </div>
          </td>
          <td className="params-cell">
            <div className="params-info">
              <code className="params-data">{decodedParams}</code>
            </div>
          </td>
        </tr>
      );

      // Recursively render subcalls
      if (call.calls && Array.isArray(call.calls) && call.calls.length > 0) {
        rows.push(...renderSubCalls(call.calls, contractData, depth + 1));
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
      <style>
        {`
          .clickable-address {
            cursor: pointer;
            transition: background-color 0.2s ease;
          }
          .clickable-address:hover {
            background-color: #e3f2fd !important;
            border-radius: 3px;
          }
          .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.3);
            z-index: 999;
          }
          .analyze-risk-button:hover {
            background: #0056b3 !important;
          }
          .close-button:hover {
            background: #f0f0f0 !important;
            border-radius: 50%;
          }
        `}
      </style>
      <div className="analyzer-header">
        <h2>🔍 Transaction Analyzer</h2>
        {currentBundleId && (
          <div className={`bundle-status ${bundleSaving ? 'saving' : 'saved'}`}>
            <span className="bundle-icon">{bundleSaving ? '🔄' : '📦'}</span>
            <span className="bundle-text">{currentBundleId.split('_')[0].slice(0, 10)}...</span>
          </div>
        )}
      </div>

      <div className="input-section">
        <div className="current-tx">
          <label>Analyzing Transaction:</label>
          <code className="tx-hash-display">{txHash || 'No transaction selected'}</code>
        </div>
        <button
          onClick={analyzeTransaction}
          disabled={!txHash || loading}
          className="analyze-button"
        >
          {loading ? 'Analyzing...' : 'Analyze with Tenderly'}
        </button>
      </div>

      {/* Show Foundry Service only after trace data is available */}
      {traceData && (
        <div className="foundry-section">
          <FoundryService
            txHash={txHash}
            onFunctionSignaturesResolved={handleFoundryFunctionSignatures}
            onContractCallsResolved={handleFoundryContractCalls}
            disabled={loading}
          />
        </div>
      )}

      {/* Bundle Management */}
      <div className="bundle-actions">
        {(debugTxResponse && traceData && basicContractData.length > 0) && (
          <button
            onClick={saveCurrentAnalysisAsBundle}
            className="save-bundle-button"
            disabled={bundleSaving}
          >
            💾 Save Analysis Bundle
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-section">
          <div className="loading-spinner"></div>
          <p>Fetching transaction data and debugging trace...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-section">
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Transaction Data */}
      {debugTxResponse?.simulation && (
        <div className="data-section">
          <h3>📊 Transaction Data</h3>

          <div className="transaction-data-container" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            {/* Long data strings in single-column grid */}
            <div className="transaction-long-data" style={{ width: '40vw', minWidth: '300px' }}>
              <div className="summary-item">
                <strong>From (EOA):</strong>
                <code className="long-address">
                  {debugTxResponse.simulation?.from || 'N/A'}
                </code>
              </div>
              <div className="summary-item">
                <strong>To:</strong>
                <code className="long-address">
                  {debugTxResponse.simulation?.to || 'N/A'}
                </code>
              </div>
              <div className="summary-item">
                <strong>Transaction Hash:</strong>
                <code className="long-hash">{txHash}</code>
              </div>
            </div>

            {/* Short fields in multi-column grid */}
            <div className="transaction-summary" style={{ width: '50vw', minWidth: '400px' }}>
              <div className="summary-item">
                <strong>Status:</strong>
                <span className={`status ${debugTxResponse.simulation?.status ? 'success' : 'failed'}`}>
                  {debugTxResponse.simulation?.status ? 'Success' : 'Failed'}
                </span>
              </div>
              <div className="summary-item">
                <strong>Gas Used:</strong>
                {debugTxResponse.simulation?.gas_used?.toLocaleString() || 'N/A'}
              </div>
              <div className="summary-item">
                <strong>Gas Limit:</strong>
                {debugTxResponse.simulation?.gas?.toLocaleString() || 'N/A'}
              </div>
              <div className="summary-item">
                <strong>Base Fee Per Gas:</strong>
                {debugTxResponse.simulation?.block_header?.baseFeePerGas ?
                  `${(parseInt(debugTxResponse.simulation.block_header.baseFeePerGas, 16) / 1e9).toFixed(2)} Gwei` : 'N/A'}
              </div>
              <div className="summary-item">
                <strong>Block Number:</strong>
                {debugTxResponse.simulation?.block_number?.toLocaleString() || 'N/A'}
              </div>
              <div className="summary-item">
                <strong>Transaction Index:</strong>
                {debugTxResponse.simulation?.transaction_index?.toString() || 'N/A'}
              </div>
              <div className="summary-item">
                <strong>Transaction Value:</strong>
                {debugTxResponse.simulation?.value ? formatValue(debugTxResponse.simulation.value) : '0'} ETH
              </div>
              <div className="summary-item">
                <strong>Nonce:</strong>
                {debugTxResponse.simulation?.nonce?.toString() || 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Tree */}
      {traceData && traceData.trace && (
        <div className="call-tree-section">
          <h4>Transaction Call Tree</h4>
          <div className="call-tree-container">
            <table className="call-tree-table">
              <thead>
                <tr>
                  <th>Call Hierarchy</th>
                  <th>Contract (from)</th>
                  <th>Contract (to)</th>
                  <th>Function</th>
                  <th>Decoded Params</th>
                </tr>
              </thead>
              <tbody>
                {renderCallTree(traceData.trace, basicContractData)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Data */}
      {addresses && addresses.length > 0 && (
        <div className="contracts-summary">
          <h4>Contracts Summary</h4>
          {contractDataLoading && (
            <p className="loading-indicator">Loading contract names...</p>
          )}
          <div className="contracts-grid">
            {addresses.map((address: string, index: number) => {
              // Find the contract name from basicContractData
              const contractName = getContractName(address);

              return (
                <div key={index} className="contract-summary-item">
                  <div className="contract-address">
                    <code>{address}...</code>
                  </div>
                  <div className="contract-name">
                    <span className="contract-name-value">
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

      {/* Access List */}
      {debugTxResponse?.generated_access_list && (
        <div className="data-section">
          <h3>📋 Access List</h3>
          <pre>{JSON.stringify(debugTxResponse.generated_access_list, null, 2)}</pre>
        </div>
      )}

      {/* Trace Summary */}
      {traceData && (
        <div className="trace-summary">
          <h4>Trace Summary</h4>
          <ul>
            <li>Total calls: {countTotalCalls(traceData.trace)}</li>
            <li>Max depth: {getMaxDepth(traceData.trace)}</li>
            <li>Unique addresses: {addresses?.length || 0}</li>
          </ul>
        </div>
      )}

      {/* Risk Analysis Popup */}
      {riskAnalysisPopup.isOpen && (
        <>
          <div className="popup-overlay" onClick={closeRiskAnalysisPopup}></div>
          <div
            className="risk-analysis-popup"
            style={{
              position: 'fixed',
              left: `${riskAnalysisPopup.position.x}px`,
              top: `${riskAnalysisPopup.position.y}px`,
              transform: 'translateY(-50%)',
              zIndex: 1000,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              minWidth: '300px',
              maxWidth: '500px'
            }}
          >
            <div className="popup-header">
              <h4 style={{ margin: '0 0 8px 0' }}>Contract Risk Analysis</h4>
              <button
                className="close-button"
                onClick={closeRiskAnalysisPopup}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            <div className="popup-body">
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#666' }}>
                <strong>Address:</strong> <code>{riskAnalysisPopup.address}</code>
              </p>

              {!riskAnalysisPopup.data && !riskAnalysisPopup.loading && !riskAnalysisPopup.error && (
                <button
                  onClick={analyzeContractRisk}
                  className="analyze-risk-button"
                  style={{
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Analyze Risk
                </button>
              )}

              {riskAnalysisPopup.loading && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: '14px', color: '#666' }}>Loading risk analysis...</div>
                </div>
              )}

              {riskAnalysisPopup.error && (
                <div style={{ color: '#dc3545', fontSize: '14px', padding: '8px', background: '#f8d7da', borderRadius: '4px' }}>
                  <strong>Error:</strong> {riskAnalysisPopup.error}
                </div>
              )}

              {riskAnalysisPopup.data && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <h5 style={{ margin: '0' }}>Risk Analysis Result:</h5>
                      <span style={{
                        background: riskAnalysisPopup.data.riskScore === 'High Risk' ? '#dc3545' :
                                   riskAnalysisPopup.data.riskScore === 'Medium Risk' ? '#ffc107' : '#28a745',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {riskAnalysisPopup.data.riskScore} (Score: {riskAnalysisPopup.data.score})
                      </span>
                    </div>
                  </div>

                  {/* Risk Categories */}
                  {riskAnalysisPopup.data.categories && (
                    <div style={{ marginBottom: '16px' }}>
                      <h6 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Risk Categories:</h6>
                      {Object.values(riskAnalysisPopup.data.categories).map((category: any, index: number) => (
                        <div key={index} style={{
                          background: '#fff3cd',
                          border: '1px solid #ffeaa7',
                          borderRadius: '4px',
                          padding: '8px',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
                            {category.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {category.description || category.gradedDescription?.high}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Key Risk Tags */}
                  {riskAnalysisPopup.data.tags && riskAnalysisPopup.data.tags.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h6 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Key Risk Findings:</h6>
                      {riskAnalysisPopup.data.tags
                        .filter((tag: any) => tag.name && tag.description)
                        .slice(0, 5)
                        .map((tag: any, index: number) => (
                        <div key={index} style={{
                          background: tag.severity >= 5 ? '#f8d7da' : '#d1ecf1',
                          border: `1px solid ${tag.severity >= 5 ? '#f5c6cb' : '#bee5eb'}`,
                          borderRadius: '4px',
                          padding: '8px',
                          marginBottom: '6px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px'
                          }}>
                            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
                              {tag.name}
                            </span>
                            <span style={{
                              background: tag.severity >= 5 ? '#dc3545' : '#17a2b8',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '11px'
                            }}>
                              Severity: {tag.severity}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {tag.description}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Analysis Details */}
                  <div style={{
                    fontSize: '12px',
                    color: '#666',
                    borderTop: '1px solid #eee',
                    paddingTop: '8px'
                  }}>
                    Analysis Type: {riskAnalysisPopup.data.analysis_type} |
                    Status: {riskAnalysisPopup.data.analysis_status}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};