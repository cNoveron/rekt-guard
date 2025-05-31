import React, { useState, useEffect } from 'react';
import './App.css';
import { TenderlyDebugger } from './components/TenderlyDebugger';
import { TransactionAnalyzer } from './components/TransactionAnalyzer';
import { AttackStepsViewer } from './components/AttackStepsViewer';
import { CalldataViewer } from './components/CalldataViewer';
import { MemoryViewer } from './components/MemoryViewer';
import { ReturnDataViewer } from './components/ReturnDataViewer';
import { EtherscanConfig } from './components/EtherscanAPI';
import { CacheManager } from './components/CacheManager';

const ATTACK_TX_HASH = '0x7e7f9548f301d3dd863eac94e6190cb742ab6aa9d7730549ff743bf84cbd21d1';

function App() {
  const [selectedTab, setSelectedTab] = useState<string>('overview');
  const [transactionData, setTransactionData] = useState<any>(null);
  const [debuggerTrace, setDebuggerTrace] = useState<any>(null);
  const [selectedStep, setSelectedStep] = useState<number>(0);

  const tabs = [
    { id: 'overview', label: 'Attack Overview' },
    { id: 'analyzer', label: 'Transaction Analyzer' },
    { id: 'steps', label: 'Attack Steps' },
    { id: 'calldata', label: 'Calldata Analysis' },
    { id: 'memory', label: 'Memory Analysis' },
    { id: 'returndata', label: 'Return Data Analysis' },
  ];

  return (
    <div className="App">
      <header className="App-header">
        <h1>Penpie Hack Analysis - Tenderly Debugger</h1>
        <p>Analyzing the $27M Penpie hack step-by-step using Tenderly's debugger API</p>
        <div className="attack-tx-info">
          <strong>Attack TX:</strong>
          <a
            href={`https://etherscan.io/tx/${ATTACK_TX_HASH}`}
            target="_blank"
            rel="noopener noreferrer"
            className="tx-link"
          >
            {ATTACK_TX_HASH}
          </a>
        </div>

        {/* API Configuration Status */}
        <div className="api-status">
          <TenderlyDebugger />
          <EtherscanConfig />
          <CacheManager />
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${selectedTab === tab.id ? 'active' : ''}`}
            onClick={() => setSelectedTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {selectedTab === 'overview' && (
          <div className="overview-section">
            <h2>Penpie Hack Overview</h2>

            <div className="setup-instructions">
              <h3>Setup Instructions</h3>
              <div className="instructions-grid">
                <div className="instruction-card">
                  <h4>1. Configure Tenderly (Required)</h4>
                  <p>Set up your Tenderly API credentials to analyze the transaction.</p>
                  <p>Without this, transaction analysis will not work.</p>
                </div>
                <div className="instruction-card">
                  <h4>2. Configure Etherscan (Optional)</h4>
                  <p>Add <code>REACT_APP_ETHERSCAN_API_KEY</code> to your .env file for better contract name resolution.</p>
                  <p>This improves the contract identification in the analysis.</p>
                </div>
                <div className="instruction-card">
                  <h4>3. Configure Infura (Optional)</h4>
                  <p>Add <code>REACT_APP_INFURA_API_KEY</code> to your .env file for more reliable blockchain data fetching.</p>
                  <p>Falls back to demo endpoints if not configured.</p>
                </div>
              </div>
            </div>

            <div className="attack-summary">
              <div className="summary-card">
                <h3>Attack Date</h3>
                <p>September 3, 2024</p>
              </div>
              <div className="summary-card">
                <h3>Total Loss</h3>
                <p>~$27 Million USD</p>
              </div>
              <div className="summary-card">
                <h3>Attack Type</h3>
                <p>Reentrancy + Market Manipulation</p>
              </div>
              <div className="summary-card">
                <h3>Target Tokens</h3>
                <p>agETH, rswETH</p>
              </div>
            </div>

            <div className="attack-flow">
              <h3>Attack Flow Summary</h3>
              <ol>
                <li><strong>Setup:</strong> Deploy malicious SY token and create fake Pendle market</li>
                <li><strong>Registration:</strong> Register fake market with Penpie (permissionless)</li>
                <li><strong>Flash Loan:</strong> Borrow agETH and rswETH from Balancer</li>
                <li><strong>Reentrancy:</strong> Exploit batchHarvestMarketRewards() to re-enter depositMarket()</li>
                <li><strong>Manipulation:</strong> Repeatedly deposit flash-loaned tokens to legitimate markets</li>
                <li><strong>Reward Claim:</strong> Claim inflated rewards from manipulated calculations</li>
                <li><strong>Withdrawal:</strong> Withdraw deposits and convert back to original tokens</li>
                <li><strong>Profit:</strong> Repay flash loans and keep the difference</li>
              </ol>
            </div>

            <div className="key-addresses">
              <h3>Key Contract Addresses</h3>
              <div className="address-grid">
                <div className="address-item">
                  <strong>Attacker Contract:</strong>
                  <code>0x4476b6ca46B28182944ED750e74e2Bb1752f87AE</code>
                </div>
                <div className="address-item">
                  <strong>Evil Market:</strong>
                  <code>0x5b6c23aedf704d19d6d8e921e638e8ae03cdca82</code>
                </div>
                <div className="address-item">
                  <strong>Pendle Staking:</strong>
                  <code>0x6E799758CEE75DAe3d84e09D40dc416eCf713652</code>
                </div>
                <div className="address-item">
                  <strong>Master Penpie:</strong>
                  <code>0x16296859C15289731521F199F0a5f762dF6347d0</code>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'analyzer' && (
          <TransactionAnalyzer
            txHash={ATTACK_TX_HASH}
            onTransactionData={setTransactionData}
            onDebuggerTrace={setDebuggerTrace}
          />
        )}

        {selectedTab === 'steps' && (
          <AttackStepsViewer
            debuggerTrace={debuggerTrace}
            selectedStep={selectedStep}
            onStepSelect={setSelectedStep}
          />
        )}

        {selectedTab === 'calldata' && (
          <CalldataViewer
            debuggerTrace={debuggerTrace}
            selectedStep={selectedStep}
          />
        )}

        {selectedTab === 'memory' && (
          <MemoryViewer
            debuggerTrace={debuggerTrace}
            selectedStep={selectedStep}
          />
        )}

        {selectedTab === 'returndata' && (
          <ReturnDataViewer
            debuggerTrace={debuggerTrace}
            selectedStep={selectedStep}
          />
        )}
      </main>
    </div>
  );
}

export default App;
