import React, { useMemo } from 'react';
import { ethers } from 'ethers';

interface CalldataViewerProps {
  debuggerTrace: any;
  selectedStep: number;
}

interface FunctionSignature {
  signature: string;
  selector: string;
  name: string;
  description?: string;
}

export const CalldataViewer: React.FC<CalldataViewerProps> = ({
  debuggerTrace,
  selectedStep
}) => {
  // Known function signatures relevant to the Penpie attack
  const knownSignatures: FunctionSignature[] = [
    { signature: '0x095ea7b3', selector: '0x095ea7b3', name: 'approve(address,uint256)', description: 'Token approval' },
    { signature: '0xa9059cbb', selector: '0xa9059cbb', name: 'transfer(address,uint256)', description: 'Token transfer' },
    { signature: '0x23b872dd', selector: '0x23b872dd', name: 'transferFrom(address,address,uint256)', description: 'Token transfer from' },
    { signature: '0x70a08231', selector: '0x70a08231', name: 'balanceOf(address)', description: 'Get token balance' },
    { signature: '0x18160ddd', selector: '0x18160ddd', name: 'totalSupply()', description: 'Get total supply' },
    { signature: '0xf6618bcc', selector: '0xf6618bcc', name: 'flashLoan(address,address[],uint256[],bytes)', description: 'Balancer flash loan' },
    { signature: '0x156e29f6', selector: '0x156e29f6', name: 'mint(address,uint256,uint256)', description: 'Mint tokens' },
    { signature: '0xdb74aa15', selector: '0xdb74aa15', name: 'mintPY(address,address)', description: 'Mint Principal/Yield tokens' },
    { signature: '0x5b6c23ae', selector: '0x5b6c23ae', name: 'registerPenpiePool(address)', description: 'Register Penpie pool' },
    { signature: '0x609e0e0c', selector: '0x609e0e0c', name: 'batchHarvestMarketRewards(address[],uint256)', description: 'Harvest market rewards' },
    { signature: '0x2d4a5b8c', selector: '0x2d4a5b8c', name: 'depositMarket(address,uint256)', description: 'Deposit to market' },
    { signature: '0x3e7a47b1', selector: '0x3e7a47b1', name: 'withdrawMarket(address,uint256)', description: 'Withdraw from market' },
    { signature: '0x1b2df850', selector: '0x1b2df850', name: 'multiclaim(address[])', description: 'Multi-claim rewards' },
    { signature: '0x73a1aa5c', selector: '0x73a1aa5c', name: 'claimRewards(address)', description: 'Claim rewards' },
  ];

  const currentStep = useMemo(() => {
    if (!debuggerTrace?.trace || selectedStep >= debuggerTrace.trace.length) {
      return null;
    }
    return debuggerTrace.trace[selectedStep];
  }, [debuggerTrace, selectedStep]);

  const analyzeCalldata = (calldata: string): any => {
    if (!calldata || calldata.length < 10) {
      return null;
    }

    const selector = calldata.slice(0, 10);
    const params = calldata.slice(10);

    const knownSig = knownSignatures.find(sig => sig.selector === selector);

    return {
      selector,
      params,
      knownFunction: knownSig,
      rawCalldata: calldata
    };
  };

  const formatParameter = (param: string, type: string): string => {
    try {
      switch (type) {
        case 'address':
          return '0x' + param.slice(24);
        case 'uint256':
          return BigInt('0x' + param).toString();
        case 'bytes32':
          return '0x' + param;
        default:
          return param;
      }
    } catch {
      return param;
    }
  };

  const decodeParameters = (params: string, functionSig: string): any[] => {
    if (!params || !functionSig.includes('(')) {
      return [];
    }

    try {
      // Extract parameter types from function signature
      const paramTypesMatch = functionSig.match(/\(([^)]*)\)/);
      if (!paramTypesMatch) return [];

      const paramTypes = paramTypesMatch[1].split(',').map(type => type.trim());
      const decoded = [];

      let offset = 0;
      for (const type of paramTypes) {
        if (offset + 64 > params.length) break;

        const paramData = params.slice(offset, offset + 64);
        decoded.push({
          type,
          value: formatParameter(paramData, type),
          raw: paramData
        });

        offset += 64;
      }

      return decoded;
    } catch (error) {
      return [];
    }
  };

  const getCallContext = (step: any): string => {
    if (!step?.address) return '';

    const addr = step.address.toLowerCase();

    if (addr === '0xba12222222228d8ba445958a75a0704d566bf2c8') {
      return 'Balancer Vault';
    } else if (addr === '0x6e799758cee75dae3d84e09d40dc416ecf713652') {
      return 'Pendle Staking';
    } else if (addr === '0x16296859c15289731521f199f0a5f762df6347d0') {
      return 'Master Penpie';
    } else if (addr === '0x4476b6ca46b28182944ed750e74e2bb1752f87ae') {
      return 'Attacker Contract';
    } else if (addr === '0xe1b4d34e8754600962cd944b535180bd758e6c2e') {
      return 'agETH Token';
    } else if (addr === '0xfae103dc9cf190ed75350761e95403b7b8afa6c0') {
      return 'rswETH Token';
    }

    return 'Unknown Contract';
  };

  if (!debuggerTrace) {
    return (
      <div className="calldata-viewer">
        <h2>Calldata Analysis</h2>
        <p>No trace data available. Please run the transaction analysis first.</p>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="calldata-viewer">
        <h2>Calldata Analysis</h2>
        <p>Select a step from the Attack Steps viewer to see calldata details.</p>
      </div>
    );
  }

  const calldataAnalysis = currentStep.input ? analyzeCalldata(currentStep.input) : null;

  return (
    <div className="calldata-viewer">
      <div className="viewer-header">
        <h2>Calldata Analysis - Step {selectedStep}</h2>

        <div className="step-summary">
          <div className="summary-item">
            <strong>Opcode:</strong> {currentStep.op}
          </div>
          <div className="summary-item">
            <strong>Address:</strong>
            <code>{currentStep.address}</code>
          </div>
          <div className="summary-item">
            <strong>Context:</strong> {getCallContext(currentStep)}
          </div>
          <div className="summary-item">
            <strong>Depth:</strong> {currentStep.depth}
          </div>
        </div>
      </div>

      {calldataAnalysis ? (
        <div className="calldata-analysis">
          <div className="function-info">
            <h3>Function Call</h3>

            <div className="function-details">
              <div className="detail-item">
                <strong>Selector:</strong>
                <code className="selector">{calldataAnalysis.selector}</code>
              </div>

              {calldataAnalysis.knownFunction ? (
                <>
                  <div className="detail-item">
                    <strong>Function:</strong>
                    <code className="function-name">{calldataAnalysis.knownFunction.name}</code>
                  </div>
                  {calldataAnalysis.knownFunction.description && (
                    <div className="detail-item">
                      <strong>Description:</strong>
                      <span>{calldataAnalysis.knownFunction.description}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="detail-item">
                  <strong>Function:</strong>
                  <span className="unknown">Unknown function</span>
                </div>
              )}
            </div>
          </div>

          <div className="raw-calldata">
            <h3>Raw Calldata</h3>
            <div className="calldata-hex">
              <div className="selector-part">
                <span className="label">Selector:</span>
                <code>{calldataAnalysis.selector}</code>
              </div>
              <div className="params-part">
                <span className="label">Parameters:</span>
                <code className="params-hex">{calldataAnalysis.params}</code>
              </div>
            </div>
          </div>

          {calldataAnalysis.knownFunction && calldataAnalysis.params && (
            <div className="decoded-parameters">
              <h3>Decoded Parameters</h3>

              {(() => {
                const decodedParams = decodeParameters(
                  calldataAnalysis.params,
                  calldataAnalysis.knownFunction.name
                );

                if (decodedParams.length === 0) {
                  return <p>No parameters or unable to decode</p>;
                }

                return (
                  <div className="parameters-list">
                    {decodedParams.map((param, index) => (
                      <div key={index} className="parameter-item">
                        <div className="param-header">
                          <strong>Parameter {index + 1}:</strong>
                          <span className="param-type">{param.type}</span>
                        </div>
                        <div className="param-value">
                          <strong>Value:</strong>
                          <code>{param.value}</code>
                        </div>
                        <div className="param-raw">
                          <strong>Raw:</strong>
                          <code>0x{param.raw}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {calldataAnalysis.knownFunction?.name.includes('flashLoan') && (
            <div className="attack-context">
              <h3>Attack Context</h3>
              <div className="context-info">
                <p><strong>Flash Loan Operation:</strong> This is where the attacker borrows agETH and rswETH from Balancer.</p>
                <p>The borrowed funds will be used to manipulate reward calculations in the reentrancy attack.</p>
              </div>
            </div>
          )}

          {calldataAnalysis.knownFunction?.name.includes('batchHarvestMarketRewards') && (
            <div className="attack-context">
              <h3>Attack Context</h3>
              <div className="context-info">
                <p><strong>Reentrancy Entry Point:</strong> This function call lacks proper reentrancy protection.</p>
                <p>During this call, the malicious SY token will re-enter the depositMarket function.</p>
              </div>
            </div>
          )}

          {calldataAnalysis.knownFunction?.name.includes('claimRewards') && (
            <div className="attack-context">
              <h3>Attack Context</h3>
              <div className="context-info">
                <p><strong>Reward Manipulation:</strong> The malicious contract returns inflated reward amounts.</p>
                <p>This step converts flash-loaned tokens to SY tokens and deposits them to legitimate markets.</p>
              </div>
            </div>
          )}
        </div>
      ) : currentStep.input ? (
        <div className="no-calldata">
          <h3>Raw Input Data</h3>
          <pre className="raw-input">{currentStep.input}</pre>
          <p>This appears to be raw input data that doesn't match standard function call format.</p>
        </div>
      ) : (
        <div className="no-calldata">
          <h3>No Calldata</h3>
          <p>This step doesn't contain any input data or calldata.</p>
        </div>
      )}

      <div className="calldata-info">
        <h4>Understanding Calldata</h4>
        <div className="info-content">
          <p>
            Calldata is the input data sent to a smart contract function. It consists of:
          </p>
          <ul>
            <li><strong>Function Selector (4 bytes):</strong> Identifies which function to call</li>
            <li><strong>Parameters (32 bytes each):</strong> The function arguments, ABI-encoded</li>
          </ul>
          <p>
            In the Penpie attack, analyzing calldata helps us understand:
          </p>
          <ul>
            <li>Which functions are being called on each contract</li>
            <li>What parameters are being passed (token amounts, addresses, etc.)</li>
            <li>How the attacker manipulates function calls during reentrancy</li>
          </ul>
        </div>
      </div>
    </div>
  );
};