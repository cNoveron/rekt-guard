import React, { useMemo, useState } from 'react';

interface ReturnDataViewerProps {
  debuggerTrace: any;
  selectedStep: number;
}

interface ReturnDataAnalysis {
  rawData: string;
  decodedData: any[];
  dataType: 'success' | 'revert' | 'empty' | 'unknown';
  interpretation: string;
}

export const ReturnDataViewer: React.FC<ReturnDataViewerProps> = ({
  debuggerTrace,
  selectedStep
}) => {
  const [displayFormat, setDisplayFormat] = useState<'hex' | 'decoded' | 'ascii'>('decoded');

  const currentStep = useMemo(() => {
    if (!debuggerTrace?.trace || selectedStep >= debuggerTrace.trace.length) {
      return null;
    }
    return debuggerTrace.trace[selectedStep];
  }, [debuggerTrace, selectedStep]);

  const analyzeReturnData = (returnData: string, opcode: string): ReturnDataAnalysis => {
    if (!returnData || returnData === '0x') {
      return {
        rawData: returnData || '',
        decodedData: [],
        dataType: 'empty',
        interpretation: 'No return data'
      };
    }

    // Remove 0x prefix if present
    const cleanData = returnData.replace(/^0x/, '');

    // Determine the type based on opcode and data
    let dataType: 'success' | 'revert' | 'empty' | 'unknown' = 'unknown';
    if (opcode === 'RETURN') {
      dataType = 'success';
    } else if (opcode === 'REVERT') {
      dataType = 'revert';
    }

    const analysis: ReturnDataAnalysis = {
      rawData: returnData,
      decodedData: [],
      dataType,
      interpretation: ''
    };

    try {
      // Try to decode as ABI-encoded data
      if (cleanData.length >= 64) {
        // Check if it's a revert with error message
        if (dataType === 'revert' && cleanData.startsWith('08c379a0')) {
          // Standard Error(string) revert
          const messageData = cleanData.slice(8); // Remove Error selector
          const decoded = decodeString(messageData);
          analysis.decodedData = [{ type: 'string', value: decoded }];
          analysis.interpretation = `Revert with message: "${decoded}"`;
        } else if (cleanData.length === 64) {
          // Single 32-byte value
          const value = BigInt('0x' + cleanData);
          analysis.decodedData = [{ type: 'uint256', value: value.toString() }];

          if (value === 0n) {
            analysis.interpretation = 'Returns zero';
          } else if (value === 1n) {
            analysis.interpretation = 'Returns true/success';
          } else if (value > BigInt(10 ** 15) && value < BigInt(10 ** 25)) {
            const ethValue = Number(value) / (10 ** 18);
            analysis.interpretation = `Token amount: ${ethValue.toFixed(6)} tokens`;
          } else {
            analysis.interpretation = `Returns: ${value.toString()}`;
          }
        } else if (cleanData.length % 64 === 0) {
          // Multiple 32-byte values
          const chunks = [];
          for (let i = 0; i < cleanData.length; i += 64) {
            const chunk = cleanData.slice(i, i + 64);
            const value = BigInt('0x' + chunk);
            chunks.push({ type: 'uint256', value: value.toString() });
          }
          analysis.decodedData = chunks;
          analysis.interpretation = `Returns ${chunks.length} values`;
        } else {
          // Try to decode as bytes
          analysis.decodedData = [{ type: 'bytes', value: cleanData }];
          analysis.interpretation = 'Raw bytes data';
        }
      } else if (cleanData.length === 40) {
        // Possible address
        analysis.decodedData = [{ type: 'address', value: '0x' + cleanData }];
        analysis.interpretation = 'Returns address';
      } else {
        analysis.decodedData = [{ type: 'bytes', value: cleanData }];
        analysis.interpretation = 'Raw bytes data';
      }
    } catch (error) {
      analysis.interpretation = 'Unable to decode return data';
    }

    return analysis;
  };

  const decodeString = (data: string): string => {
    try {
      // Skip the first 64 chars (offset and length)
      if (data.length < 128) return '';

      const lengthHex = data.slice(64, 128);
      const length = parseInt(lengthHex, 16);
      const stringData = data.slice(128, 128 + length * 2);

      return stringData.match(/.{1,2}/g)
        ?.map(hex => String.fromCharCode(parseInt(hex, 16)))
        .join('') || '';
    } catch {
      return '';
    }
  };

  const formatReturnData = (data: string, format: 'hex' | 'decoded' | 'ascii'): string => {
    if (!data) return '';

    switch (format) {
      case 'hex':
        return data.match(/.{1,2}/g)?.join(' ') || data;
      case 'ascii':
        try {
          const cleanData = data.replace(/^0x/, '');
          return cleanData.match(/.{1,2}/g)
            ?.map(hex => {
              const code = parseInt(hex, 16);
              return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.';
            })
            .join('') || '';
        } catch {
          return '';
        }
      case 'decoded':
      default:
        return data;
    }
  };

  const getReturnContext = (step: any, analysis: ReturnDataAnalysis): string => {
    if (!step?.address) return '';

    const addr = step.address.toLowerCase();

    if (addr === '0xba12222222228d8ba445958a75a0704d566bf2c8') {
      if (analysis.dataType === 'success' && analysis.decodedData.length > 0) {
        return 'Balancer flash loan executed successfully';
      }
    } else if (addr === '0x6e799758cee75dae3d84e09d40dc416ecf713652') {
      if (analysis.interpretation.includes('Token amount')) {
        return 'Pendle Staking returned token balance/amount';
      }
    } else if (addr === '0x4476b6ca46b28182944ed750e74e2bb1752f87ae') {
      if (analysis.decodedData.some(d => d.type === 'address')) {
        return 'Attacker contract returned token addresses for reward manipulation';
      }
    }

    return '';
  };

  if (!debuggerTrace) {
    return (
      <div className="returndata-viewer">
        <h2>Return Data Analysis</h2>
        <p>No trace data available. Please run the transaction analysis first.</p>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="returndata-viewer">
        <h2>Return Data Analysis</h2>
        <p>Select a step from the Attack Steps viewer to see return data.</p>
      </div>
    );
  }

  const returnData = currentStep.output || currentStep.returnData || '';
  const analysis = analyzeReturnData(returnData, currentStep.op);
  const context = getReturnContext(currentStep, analysis);

  return (
    <div className="returndata-viewer">
      <div className="viewer-header">
        <h2>Return Data Analysis - Step {selectedStep}</h2>

        <div className="step-info">
          <div className="info-item">
            <strong>Opcode:</strong> {currentStep.op}
          </div>
          <div className="info-item">
            <strong>Address:</strong>
            <code>{currentStep.address}</code>
          </div>
          <div className="info-item">
            <strong>Data Type:</strong>
            <span className={`data-type ${analysis.dataType}`}>
              {analysis.dataType.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="format-controls">
          <label>Display Format:</label>
          <select
            value={displayFormat}
            onChange={(e) => setDisplayFormat(e.target.value as 'hex' | 'decoded' | 'ascii')}
          >
            <option value="decoded">Decoded</option>
            <option value="hex">Hexadecimal</option>
            <option value="ascii">ASCII</option>
          </select>
        </div>
      </div>

      {analysis.dataType === 'empty' ? (
        <div className="no-return-data">
          <h3>No Return Data</h3>
          <p>This operation did not return any data.</p>
          <p>This is common for:</p>
          <ul>
            <li>State-changing functions that only modify storage</li>
            <li>Functions that return void</li>
            <li>Failed calls that don't produce output</li>
          </ul>
        </div>
      ) : (
        <div className="return-analysis">
          <div className="interpretation">
            <h3>Interpretation</h3>
            <p className="interpretation-text">{analysis.interpretation}</p>
            {context && (
              <p className="context-text">
                <strong>Attack Context:</strong> {context}
              </p>
            )}
          </div>

          <div className="decoded-data">
            <h3>Decoded Values</h3>
            {analysis.decodedData.length > 0 ? (
              <div className="values-list">
                {analysis.decodedData.map((item, index) => (
                  <div key={index} className="value-item">
                    <div className="value-header">
                      <strong>Value {index + 1}:</strong>
                      <span className="value-type">{item.type}</span>
                    </div>
                    <div className="value-content">
                      <code className="value-data">{item.value}</code>
                    </div>

                    {item.type === 'uint256' && BigInt(item.value) > BigInt(10 ** 15) && (
                      <div className="value-interpretation">
                        <strong>As ETH:</strong> {(Number(item.value) / (10 ** 18)).toFixed(6)} ETH
                      </div>
                    )}

                    {item.type === 'address' && (
                      <div className="value-interpretation">
                        <strong>Address:</strong>
                        <a
                          href={`https://etherscan.io/address/${item.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.value}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p>No decoded values available</p>
            )}
          </div>

          <div className="raw-return-data">
            <h3>Raw Return Data</h3>
            <div className="raw-data-container">
              <div className="data-stats">
                <span><strong>Length:</strong> {returnData.length} chars ({(returnData.length - 2) / 2} bytes)</span>
              </div>

              <pre className="raw-data">
                {formatReturnData(returnData.replace(/^0x/, ''), displayFormat)}
              </pre>
            </div>
          </div>

          {analysis.dataType === 'revert' && (
            <div className="revert-analysis">
              <h3>Revert Analysis</h3>
              <div className="revert-info">
                <p>This operation reverted (failed) and returned error data.</p>
                {analysis.decodedData.length > 0 && analysis.decodedData[0].type === 'string' && (
                  <div className="error-message">
                    <strong>Error Message:</strong> "{analysis.decodedData[0].value}"
                  </div>
                )}
                <p>In the context of the Penpie attack, reverts might indicate:</p>
                <ul>
                  <li>Failed validation checks</li>
                  <li>Insufficient balances</li>
                  <li>Access control violations</li>
                  <li>Reentrancy protection triggers</li>
                </ul>
              </div>
            </div>
          )}

          {currentStep.op === 'RETURN' && analysis.decodedData.some(d => d.type === 'address') && (
            <div className="attack-context">
              <h3>Attack Context: Reward Token Manipulation</h3>
              <div className="context-info">
                <p>
                  This return data contains addresses that are likely the reward tokens returned by the malicious SY contract.
                  In the Penpie attack, the malicious `getRewardTokens()` function returns real SY token addresses (agETH and rswETH SY)
                  to trick Penpie into thinking these are legitimate rewards.
                </p>
                <p>
                  Key insight: The attacker exploits the trust relationship where Penpie assumes markets will honestly report their reward tokens.
                </p>
              </div>
            </div>
          )}

          {analysis.interpretation.includes('Token amount') && (
            <div className="attack-context">
              <h3>Attack Context: Token Amount Manipulation</h3>
              <div className="context-info">
                <p>
                  This return value represents a token amount that's being manipulated during the attack.
                  The attacker uses flash-loaned funds to inflate these amounts and claim disproportionate rewards from Penpie.
                </p>
                <p>
                  The reentrancy vulnerability allows the attacker to repeatedly deposit and withdraw these amounts,
                  manipulating the reward calculation in their favor.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="returndata-info">
        <h4>Understanding Return Data</h4>
        <div className="info-content">
          <p>
            Return data is the output from function calls and operations. In the Penpie attack context:
          </p>
          <ul>
            <li><strong>Success Returns:</strong> Expected function outputs (addresses, amounts, booleans)</li>
            <li><strong>Revert Data:</strong> Error messages when operations fail</li>
            <li><strong>Token Addresses:</strong> Addresses returned by malicious `getRewardTokens()` calls</li>
            <li><strong>Token Amounts:</strong> Manipulated amounts used in reward calculations</li>
          </ul>
          <p>
            Key patterns in the attack:
          </p>
          <ul>
            <li>The malicious SY contract returns real token addresses to appear legitimate</li>
            <li>Token amounts are inflated through repeated reentrancy</li>
            <li>Return data helps trace the flow of manipulated values</li>
          </ul>
        </div>
      </div>
    </div>
  );
};