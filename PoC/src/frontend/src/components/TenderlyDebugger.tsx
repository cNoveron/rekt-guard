import React, { useState } from 'react';
import axios from 'axios';

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
  async debugTransaction(txHash: string): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    if (!config.accountSlug || !config.projectSlug || !config.accessKey) {
      throw new Error('Tenderly not configured');
    }

    try {
      const response = await axios.post(
        `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/simulate`,
        {
          network_id: '1', // Ethereum mainnet
          transaction: {
            hash: txHash
          },
          save: true,
          save_if_fails: true,
          simulation_type: 'quick'
        },
        {
          headers: {
            'X-Access-Key': config.accessKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Tenderly API error:', error);
      throw error;
    }
  },

  async getTransactionTrace(simulationId: string): Promise<any> {
    const config = JSON.parse(localStorage.getItem('tenderly-config') || '{}');

    try {
      const response = await axios.get(
        `https://api.tenderly.co/api/v1/account/${config.accountSlug}/project/${config.projectSlug}/simulations/${simulationId}/debugger-trace`,
        {
          headers: {
            'X-Access-Key': config.accessKey
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Tenderly trace error:', error);
      throw error;
    }
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
    } catch (error) {
      console.error('Tenderly call trace error:', error);
      throw error;
    }
  }
};