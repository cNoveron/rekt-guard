# Penpie Hack Analysis - Tenderly Debugger

A React application for analyzing the $27M Penpie hack using Tenderly's debugger API. This tool provides step-by-step analysis of the attack transaction, including calldata, memory, and return data examination.

## About the Penpie Hack

The Penpie hack occurred on September 3, 2024, resulting in approximately $27 million USD in losses. The attack exploited vulnerabilities in the Pendle and Penpie integration through:

1. **Reentrancy Vulnerability**: The `batchHarvestMarketRewards()` function lacked proper reentrancy protection
2. **Permissionless Registration**: Allowed registration of a fake Pendle market with malicious SY contract
3. **Reward Manipulation**: Used flash loans and reentrancy to inflate reward calculations

**Attack Transaction**: `0x7e7f9548f301d3dd863eac94e6190cb742ab6aa9d7730549ff743bf84cbd21d1`

## Features

- **Transaction Overview**: Summary of the attack mechanism and key components
- **Tenderly Integration**: Connect to Tenderly's debugger API for detailed analysis
- **Step-by-Step Execution**: View every opcode execution during the attack
- **Calldata Analysis**: Decode function calls and parameters
- **Memory Analysis**: Examine EVM memory state at each step
- **Return Data Analysis**: Analyze function return values and outputs
- **Attack Context**: Educational insights about each step of the attack

## Prerequisites

- Node.js (v16 or higher)
- A [Tenderly account](https://dashboard.tenderly.co/) (free tier is sufficient)
- Basic understanding of Ethereum transactions and smart contracts

## Setup Instructions

1. **Clone and Install Dependencies**:
   ```bash
   cd PoC/src/frontend
   npm install
   ```

2. **Get Tenderly Credentials**:
   - Sign up for a [Tenderly account](https://dashboard.tenderly.co/)
   - Create a new project in your dashboard
   - Go to Settings → Access Keys to generate an API key
   - Note your account slug (username) and project slug (project name)

3. **Start the Application**:
   ```bash
   npm start
   ```
   The application will open at `http://localhost:3000`

## Usage Guide

### 1. Configure Tenderly API

1. Click on the Tenderly configuration section at the bottom of the page
2. Enter your credentials:
   - **Account Slug**: Your Tenderly username
   - **Project Slug**: Your Tenderly project name
   - **Access Key**: Your Tenderly API key
3. Click "Connect to Tenderly"

### 2. Analyze the Attack Transaction

1. Navigate to the **Transaction Analyzer** tab
2. Click "Analyze with Tenderly" to start the simulation
3. Wait for the analysis to complete (this may take 30-60 seconds)

### 3. Explore the Attack Steps

Once analysis is complete, you can explore different aspects:

- **Attack Steps**: Browse through every execution step with filtering options
- **Calldata Analysis**: Examine function calls and their parameters
- **Memory Analysis**: View EVM memory state at each step
- **Return Data Analysis**: Analyze function return values

### 4. Understanding the Attack

The application provides educational context for each step, helping you understand:

- How the flash loan was initiated
- Where reentrancy occurred
- How rewards were manipulated
- Key addresses and contracts involved

## Troubleshooting

### "From address not valid" Error

This error is now fixed in the latest version. The application properly fetches transaction data and formats it correctly for Tenderly's simulation API.

### "Tenderly not configured" Error

Make sure you've entered your Tenderly credentials correctly and clicked "Connect to Tenderly".

### Simulation Takes Too Long

The analysis of complex transactions can take time. The Penpie attack transaction is particularly complex with thousands of execution steps.

### Network Issues

The application requires internet access to:
- Fetch transaction data from Ethereum mainnet
- Connect to Tenderly's API
- Load transaction details

## Technical Details

### Architecture

- **Frontend**: React with TypeScript
- **Blockchain Data**: Ethers.js for transaction fetching
- **Debugging**: Tenderly API for transaction simulation and tracing
- **Styling**: CSS with modern design patterns

### Key Components

- `TenderlyDebugger`: Manages Tenderly API configuration and connection
- `TransactionAnalyzer`: Fetches and displays transaction simulation results
- `AttackStepsViewer`: Displays step-by-step execution trace
- `CalldataViewer`: Analyzes and decodes function call data
- `MemoryViewer`: Examines EVM memory state
- `ReturnDataViewer`: Analyzes function return values

### Attack Analysis Features

- **Function Signature Recognition**: Identifies common DeFi function calls
- **Address Context**: Recognizes key contracts in the attack
- **Attack Step Identification**: Highlights critical moments in the attack
- **Data Formatting**: Converts raw hex data to human-readable formats

## Educational Value

This tool is designed for educational purposes to help developers and security researchers understand:

- How reentrancy attacks work in practice
- The importance of proper access controls
- How flash loans can amplify attacks
- Smart contract security best practices

## Contributing

This tool was created to demonstrate the Penpie hack analysis. Feel free to:

- Report issues or bugs
- Suggest improvements
- Add support for analyzing other attacks
- Improve the educational content

## Disclaimer

This tool is for educational and research purposes only. The analyzed attack represents real losses and should serve as a learning opportunity to prevent similar vulnerabilities in the future.

## Resources

- [Penpie Official Response](https://medium.com/@penpiexyz_48110/penpie-protocol-incident-analysis-8c72b1d6e7d2)
- [Tenderly Documentation](https://docs.tenderly.co/)
- [Ethereum Transaction Analysis](https://etherscan.io/tx/0x7e7f9548f301d3dd863eac94e6190cb742ab6aa9d7730549ff743bf84cbd21d1)
- [DeFi Security Best Practices](https://github.com/crytic/building-secure-contracts)

## License

This project is open source and available under the MIT License.
