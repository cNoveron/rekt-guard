import React, { useState } from 'react';
import axios from 'axios';
import { ethers } from 'ethers';
import { transactionCache, simulationCache } from '../utils/ApiCache';

interface TenderlyConfig {
  accountSlug: string;
  projectSlug: string;
  accessKey: string;
}

export const TenderlyDebugger: React.FC = () => {
  const [config, setConfig] = useState<TenderlyConfig>({
    accountSlug: '',
    projectSlug: '',
    accessKey: ''
  });
  const [isConfigured, setIsConfigured] = useState(false);

  const handleConfigSave = () => {
    if (config.accountSlug && config.projectSlug && config.accessKey) {
      setIsConfigured(true);
      // Store in localStorage for persistence
      localStorage.setItem('tenderly-config', JSON.stringify(config));
    }
  };

  const loadStoredConfig = () => {
    const stored = localStorage.getItem('tenderly-config');
    if (stored) {
      const parsedConfig = JSON.parse(stored);
      setConfig(parsedConfig);
      setIsConfigured(true);
    }
  };

  React.useEffect(() => {
    loadStoredConfig();
  }, []);

  if (isConfigured) {
    return (
      <div className="tenderly-status">
        <span className="status-indicator connected">✓ Connected to Tenderly</span>
        <button
          onClick={() => setIsConfigured(false)}
          className="config-button"
        >
          Reconfigure
        </button>
      </div>
    );
  }

  return (
    <div className="tenderly-config">
      <h3>Configure Tenderly API</h3>
      <p>Enter your Tenderly credentials to enable transaction debugging:</p>

      <div className="config-form">
        <input
          type="text"
          placeholder="Account Slug"
          value={config.accountSlug}
          onChange={(e) => setConfig({...config, accountSlug: e.target.value})}
        />
        <input
          type="text"
          placeholder="Project Slug"
          value={config.projectSlug}
          onChange={(e) => setConfig({...config, projectSlug: e.target.value})}
        />
        <input
          type="password"
          placeholder="Access Key"
          value={config.accessKey}
          onChange={(e) => setConfig({...config, accessKey: e.target.value})}
        />
        <button onClick={handleConfigSave}>
          Connect to Tenderly
        </button>
      </div>

      <div className="config-help">
        <h4>How to get Tenderly credentials:</h4>
        <ol>
          <li>Sign up for a <a href="https://dashboard.tenderly.co/" target="_blank" rel="noopener noreferrer">Tenderly account</a></li>
          <li>Create a project in your dashboard</li>
          <li>Go to Settings → Access Keys to generate an API key</li>
          <li>Your account slug is your username, project slug is your project name</li>
        </ol>
      </div>
    </div>
  );
};

// Utility function to make Tenderly API calls
export const tenderlyAPI = {
  async getTransactionData(txHash: string): Promise<any> {
    const cacheKey = `tx_data_${txHash.toLowerCase()}`;

    // Check cache first
    const cached = transactionCache.get(cacheKey);
    if (cached) {
      console.log(`Transaction data cache hit for: ${txHash}`);
      return cached;
    }

    try {
      // Use Infura or Alchemy as a fallback RPC provider
      const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_API_KEY}`);

      console.log(`Fetching transaction data for: ${txHash}`);
      // Fetch the transaction and receipt
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(txHash),
        provider.getTransactionReceipt(txHash)
      ]);

      if (!tx) {
        throw new Error('Transaction not found');
      }

      const result = {
        transaction: tx,
        receipt: receipt,
        blockNumber: tx.blockNumber
      };

      // Cache for 7 days
      transactionCache.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000);
      return result;
    } catch (error) {
      console.error('Error fetching transaction data:', error);
      throw error;
    }
  },

  async getTransactionFromTenderly(txHash: string): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    try {
      // Try to get transaction data directly from Tenderly
      const response = await axios.get(
        `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/transactions/${txHash}`,
        {
          headers: {
            'X-Access-Key': config.accessKey
          }
        }
      );

      console.log('Tenderly transaction data:', response.data);
      return response.data;
    } catch (error: any) {
      console.log('Failed to get transaction from Tenderly:', error.response?.status);

      // Try alternative endpoint for public transactions
      try {
        const publicResponse = await axios.get(
          `https://api.tenderly.co/api/v1/public-contract/1/transactions/${txHash}`,
          {
            headers: {
              'X-Access-Key': config.accessKey
            }
          }
        );

        console.log('Tenderly public transaction data:', publicResponse.data);
        return publicResponse.data;
      } catch (publicError) {
        console.log('Failed to get public transaction from Tenderly:', publicError);
        throw error;
      }
    }
  },

  async waitForSimulation(simulationId: string, maxRetries: number = 1): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get(
          `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/simulations/${simulationId}`,
          {
            headers: {
              'X-Access-Key': config.accessKey
            }
          }
        );

        const simulation = response.data.simulation;
        console.log(`Simulation ${simulationId} status:`, simulation.status);

        if (simulation.status) {
          return response.data;
        }

        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Error checking simulation status (attempt ${i + 1}):`, error);
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error('Simulation did not complete within expected time');
  },

  async debugTransaction(txHash: string): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    if (!config.accountSlug || !config.projectSlug || !config.accessKey) {
      throw new Error('Tenderly not configured');
    }

    try {
      // First, try to get the transaction directly from Tenderly (if it exists)
      let tenderlyTxData = null;
      try {
        tenderlyTxData = await this.getTransactionFromTenderly(txHash);
      } catch (error) {
        console.log('Transaction not found in Tenderly, will simulate it');
      }

      // If we found the transaction in Tenderly and it has trace data, use it
      if (tenderlyTxData && tenderlyTxData.transaction) {
        console.log('Using existing Tenderly transaction data');
        return {
          simulation: {
            id: `existing-${txHash}`,
            status: 'success'
          },
          transaction: tenderlyTxData.transaction,
          existing_transaction: true
        };
      }

      // Otherwise, get transaction data from blockchain and simulate
      const txData = await this.getTransactionData(txHash);
      const tx = txData.transaction;

      // Format the transaction for Tenderly simulation API
      const simulationPayload = {
        network_id: '1', // Ethereum mainnet
        block_number: tx.blockNumber || 'latest',
        from: tx.from,
        to: tx.to,
        input: tx.data || '0x',
        gas: parseInt(tx.gasLimit?.toString() || '8000000'),
        gas_price: parseInt(tx.gasPrice?.toString() || '0'),
        value: parseInt(tx.value?.toString() || '0'),
        save: true,
        save_if_fails: true,
        simulation_type: 'full'
      };

      console.log('Simulation payload:', simulationPayload);

      const response = await axios.post(
        `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/simulate`,
        simulationPayload,
        {
          headers: {
            'X-Access-Key': config.accessKey,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Simulation response:', response.data);

      // Wait for simulation to complete
      if (response.data.simulation && response.data.simulation.id) {
        const completedSimulation = await this.waitForSimulation(response.data.simulation.id);
        return completedSimulation;
      }

      return response.data;
    } catch (error: any) {
      console.error('Tenderly API error:', error);

      // Provide more helpful error messages
      if (error.response?.data?.error?.message) {
        throw new Error(`Tenderly Error: ${error.response.data.error.message}`);
      } else if (error.response?.status === 401) {
        throw new Error('Invalid Tenderly API credentials. Please check your access key.');
      } else if (error.response?.status === 400) {
        throw new Error('Invalid simulation parameters. Please check the transaction data.');
      }

      throw error;
    }
  },

  async getTransactionTrace(simulationId: string): Promise<any> {
    // Extract transaction hash from simulationId if it's an existing transaction
    let txHash = simulationId;
    if (simulationId.startsWith('existing-')) {
      txHash = simulationId.replace('existing-', '');
    } else {
      // For new simulations, we need the original transaction hash
      // Use the global ATTACK_TX_HASH for now
      txHash = '0x42b2ec27c732100dd9037c76da415e10329ea41598de453bb0c0c9ea7ce0d8e5';
    }

    // Check cache first
    const cached = transactionCache.getCachedTransactionTrace(txHash);
    if (cached) {
      console.log(`Transaction trace cache hit for: ${txHash}`);
      return cached;
    }

    try {
      console.log(`Tracing transaction: ${txHash}`);

      const response = await axios.post(
        `https://mainnet.gateway.tenderly.co/${process.env.REACT_APP_TENDERLY_PRC_ACCESS_KEY}`,
        {
          jsonrpc: "2.0",
          id: 0,
          method: "debug_traceTransaction",
          params: [
            txHash,
            {
              tracer: "callTracer"
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('Trace data received:', response.data);

      if (response.data.result) {
        // Return the raw call trace data for proper tree display
        const result = {
          trace: response.data.result,
          source: 'tenderly_node'
        };

        // Cache the trace for 7 days
        transactionCache.cacheTransactionTrace(txHash, result);
        return result;
      } else if (response.data.error) {
        throw new Error(`Tenderly Node API error: ${response.data.error.message}`);
      }

      return {
        trace: [],
        message: 'No trace data returned from Tenderly Node API'
      };
    } catch (error: any) {
      console.error('Tenderly Node API error:', error);

      if (error.response?.data?.error) {
        throw new Error(`Tenderly Node API error: ${error.response.data.error.message}`);
      }

      throw new Error(`Failed to trace transaction: ${error.message}`);
    }
  },

  convertCallTraceToExecutionTrace(callTrace: any[]): any[] {
    // Convert Tenderly's call trace format to something resembling execution trace
    const executionTrace: any[] = [];
    let stepIndex = 0;

    const processCall = (call: any, depth: number = 0) => {
      executionTrace.push({
        pc: stepIndex++,
        op: call.function_name || 'CALL',
        depth: depth,
        gas: call.gas_used || 0,
        gasCost: call.gas_cost || 0,
        address: call.to,
        input: call.input,
        output: call.output,
        value: call.value,
        type: 'CALL'
      });

      if (call.calls && call.calls.length > 0) {
        call.calls.forEach((subcall: any) => processCall(subcall, depth + 1));
      }
    };

    if (Array.isArray(callTrace)) {
      callTrace.forEach(call => processCall(call, 0));
    }

    return executionTrace;
  },

  async getCallTrace(simulationId: string): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    try {
      const response = await axios.get(
        `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/simulations/${simulationId}/call-trace`,
        {
          headers: {
            'X-Access-Key': config.accessKey
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Tenderly call trace error:', error);

      // If call trace is not available, return empty structure
      if (error.response?.status === 404) {
        return {
          call_trace: [],
          message: 'Call trace not available for this simulation'
        };
      }

      throw error;
    }
  }
};