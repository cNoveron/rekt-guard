import React, { useState, useEffect, useCallback } from 'react';
import { tenderlyAPI } from './TenderlyDebugger';
import { etherscanAPI } from './EtherscanAPI';

interface TransactionAnalyzerProps {
  txHash: string;
  onTransactionData: (data: any) => void;
  onDebuggerTrace: (trace: any) => void;
}

export const TransactionAnalyzer: React.FC<TransactionAnalyzerProps> = ({
  txHash,
  onTransactionData,
  onDebuggerTrace
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugTxResponse, setDebugTxResponse] = useState<any>(null);
  const [addresses, setAddresses] = useState<string[]| null>(null);
  const [traceData, setTraceData] = useState<any>(null);
  const [basicContractData, setBasicContractData] = useState<[string, string][]>([]);
  const [contractDataLoading, setContractDataLoading] = useState(false);

  const analyzeTransaction = async () => {
    setLoading(true);
    setError(null);

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
    fetchContractNames(addresses);
  }, [addresses, fetchContractNames]);

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

  return (
    <div className="transaction-analyzer">
      <div className="analyzer-header">
        <h2>Transaction Analysis</h2>
        <button
          onClick={analyzeTransaction}
          disabled={loading}
          className="analyze-button"
        >
          {loading ? 'Analyzing...' : 'Analyze with Tenderly'}
        </button>
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

          {addresses && addresses.length > 0 && (
            <div className="contracts-involved">
              <h4>Contracts Involved</h4>
              {contractDataLoading && (
                <p className="loading-indicator">Loading contract names...</p>
              )}
              <div className="contracts-list">
                {addresses.map((address: string, index: number) => {
                  // Find the contract name from basicContractData
                  const contractData = basicContractData.find(([addr, _]) => addr.toLowerCase() === address.toLowerCase());
                  const contractName = contractData ? contractData[1] : 'Loading...';

                  return (
                    <div key={index} className="contract-item">
                      <div className="contract-address">
                        <strong>Address:</strong>
                        <code>{address}</code>
                      </div>
                      <div className="contract-name">
                        <strong>Name:</strong>
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
              <strong>Total Steps:</strong> {traceData.trace?.length || 0}
            </div>
            <div className="stat-item">
              <strong>Call Depth:</strong> {Math.max(...(traceData.trace?.map((step: any) => step.depth) || [0]))}
            </div>
            <div className="stat-item">
              <strong>Opcodes Used:</strong> {new Set(traceData.trace?.map((step: any) => step.op) || []).size}
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