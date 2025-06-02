import React, { useState, useEffect } from 'react';

interface FoundryServiceProps {
  txHash: string; // Now passed from parent instead of user input
  onFunctionSignaturesResolved?: (functionSignatures: Map<string, string>) => void;
  onContractCallsResolved?: (contractCalls: ContractCall[]) => void;
  disabled?: boolean; // Allow parent to disable the button
}

interface FunctionSignature {
  selector: string;
  name: string;
}

interface ContractCall {
  address: string;
  functionName: string;
  fullSignature: string;
  selector: string;
  callType?: string;
  params?: string; // Decoded parameters from cast run
}

interface FunctionInfo {
  functionSignatures: FunctionSignature[];
  contractCalls: ContractCall[];
  totalFunctions: number;
  totalCalls: number;
}

interface CastRunResult {
  success: boolean;
  functionInfo?: FunctionInfo;
  error?: string;
  rawOutput?: string;
}

interface CastCheckResult {
  available: boolean;
  version?: string;
  error?: string;
  message: string;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

export const FoundryService: React.FC<FoundryServiceProps> = ({
  txHash,
  onFunctionSignaturesResolved,
  onContractCallsResolved,
  disabled = false
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CastRunResult | null>(null);
  const [castAvailable, setCastAvailable] = useState<CastCheckResult | null>(null);
  const [isCheckingCast, setIsCheckingCast] = useState(true);

  // Check if cast is available on component mount
  useEffect(() => {
    checkCastAvailability();
  }, []);

  const checkCastAvailability = async () => {
    setIsCheckingCast(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/cast-check`);
      const result: CastCheckResult = await response.json();
      setCastAvailable(result);
    } catch (error) {
      setCastAvailable({
        available: false,
        error: 'Failed to connect to backend service',
        message: 'Backend service unavailable'
      });
    } finally {
      setIsCheckingCast(false);
    }
  };

  const runCastCommand = async () => {
    if (!txHash || disabled) return;

    setIsRunning(true);
    setLastResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/cast-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txHash }),
      });

      const result: CastRunResult = await response.json();
      setLastResult(result);

      if (result.success && result.functionInfo && onFunctionSignaturesResolved) {
        // Convert function signatures array to Map
        const sigMap = new Map<string, string>();
        result.functionInfo.functionSignatures.forEach(sig => {
          sigMap.set(sig.selector, sig.name);
        });
        onFunctionSignaturesResolved(sigMap);
      }

      if (result.success && result.functionInfo && onContractCallsResolved) {
        onContractCallsResolved(result.functionInfo.contractCalls);
      }
    } catch (error) {
      setLastResult({
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Don't render if cast is not available
  if (isCheckingCast) {
    return (
      <div className="foundry-service">
        <div className="cast-check-status checking">
          <span className="status-icon">⏳</span>
          <span>Checking Foundry availability...</span>
        </div>
      </div>
    );
  }

  if (!castAvailable?.available) {
    return (
      <div className="foundry-service">
        <div className="cast-check-status unavailable">
          <span className="status-icon">❌</span>
          <div className="cast-unavailable">
            <span>Foundry not available</span>
            <details>
              <summary>Details</summary>
              <p>{castAvailable?.message || 'Unknown error'}</p>
              {castAvailable?.error && <p><strong>Error:</strong> {castAvailable.error}</p>}
            </details>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="foundry-service">
      <div className="foundry-header">
        <h3>🔨 Function Signature Resolution</h3>
        <p className="foundry-description">
          Use Foundry's <code>cast run</code> to resolve function signatures from the transaction trace.
        </p>
      </div>

      <div className="cast-check-status available">
        <span className="status-icon">✅</span>
        <div className="cast-available">
          <span>Foundry available: {castAvailable.version}</span>
        </div>
      </div>

      <div className="foundry-controls">
        <button
          onClick={runCastCommand}
          disabled={isRunning || disabled || !txHash}
          className={`foundry-button ${isRunning ? 'running' : ''}`}
        >
          {isRunning ? (
            <>
              <span className="spinner">⏳</span>
              Resolving Functions...
            </>
          ) : (
            <>
              <span>🔍</span>
              Resolve Function Signatures
            </>
          )}
        </button>
      </div>

      {lastResult && (
        <div className="foundry-results">
          {lastResult.success ? (
            <div className="success-result">
              <h4>✅ Function Resolution Complete</h4>
              {lastResult.functionInfo && (
                <div className="function-stats">
                  <p>
                    <strong>{lastResult.functionInfo.totalFunctions}</strong> function signatures resolved
                    from <strong>{lastResult.functionInfo.totalCalls}</strong> contract calls
                  </p>

                  {lastResult.functionInfo.functionSignatures.length > 0 && (
                    <details className="resolved-functions-details">
                      <summary>View Resolved Functions ({lastResult.functionInfo.functionSignatures.length})</summary>
                      <div className="resolved-functions">
                        <div className="function-mapping-header">
                          <span className="header-hex">Hex Selector</span>
                          <span className="header-arrow">→</span>
                          <span className="header-function">Decoded Function Name</span>
                        </div>
                        {lastResult.functionInfo.functionSignatures.slice(0, 15).map((sig, index) => (
                          <div key={index} className="resolved-function-item">
                            <div className="function-mapping">
                              <span className="function-selector" title={`4-byte function selector: ${sig.selector}`}>
                                {sig.selector}
                              </span>
                              <span className="mapping-arrow">→</span>
                              <span className="function-name" title={`Resolved function name: ${sig.name}`}>
                                {sig.name}
                              </span>
                              <span className="resolution-badge" title="Resolved by Foundry cast run">
                                🔨
                              </span>
                            </div>
                          </div>
                        ))}
                        {lastResult.functionInfo.functionSignatures.length > 15 && (
                          <div className="more-functions">
                            <span className="more-count">
                              + {lastResult.functionInfo.functionSignatures.length - 15} more functions resolved
                            </span>
                            <details className="show-all-functions">
                              <summary>Show all {lastResult.functionInfo.functionSignatures.length} functions</summary>
                              <div className="all-functions-list">
                                {lastResult.functionInfo.functionSignatures.slice(15).map((sig, index) => (
                                  <div key={index + 15} className="resolved-function-item compact">
                                    <div className="function-mapping">
                                      <span className="function-selector">{sig.selector}</span>
                                      <span className="mapping-arrow">→</span>
                                      <span className="function-name">{sig.name}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {lastResult.functionInfo.contractCalls.length > 0 && (
                    <details className="contract-calls">
                      <summary>Contract Calls ({lastResult.functionInfo.contractCalls.length})</summary>
                      <div className="contract-calls-list">
                        {lastResult.functionInfo.contractCalls.slice(0, 5).map((call, index) => (
                          <div key={index} className="contract-call-item">
                            <span className="call-type">{call.callType || 'call'}</span>
                            <span className="call-address">{call.address.slice(0, 10)}...</span>
                            <span className="call-function">{call.functionName}</span>
                          </div>
                        ))}
                        {lastResult.functionInfo.contractCalls.length > 5 && (
                          <p className="more-calls">
                            ... and {lastResult.functionInfo.contractCalls.length - 5} more calls
                          </p>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="error-result">
              <h4>❌ Function Resolution Failed</h4>
              <p>{lastResult.error}</p>
              {lastResult.rawOutput && (
                <details>
                  <summary>Raw Output</summary>
                  <pre className="raw-output">{lastResult.rawOutput}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};