# Foundry Integration for Function Signature Resolution

## Overview

The Penpie Hack Analysis tool now integrates with Foundry's `cast run` command to resolve function signatures from raw hex values in the transaction call tree. This provides much more readable function names instead of cryptic hex signatures.

## ✨ **New Improved Workflow**

1. **Transaction Input**: Enter transaction hash in the main interface
2. **Analyze with Tenderly**: Click to fetch transaction data and trace
3. **Foundry Resolution**: After trace is loaded, the "Resolve Function Signatures" button appears
4. **Enhanced Call Tree**: Function signatures are resolved and displayed with visual indicators

## Features

### ✅ **Contextual Function Resolution**
- Foundry service only appears after trace data is successfully loaded
- Uses the current transaction hash automatically (no manual input needed)
- Integrates seamlessly with the existing analysis workflow
- Disabled during loading states to prevent conflicts

### ✅ **Real-time Function Resolution**
- Executes `cast run` command on the analyzed transaction hash
- Extracts function signatures from the trace output
- Maps 4-byte selectors to human-readable function names
- Displays resolved functions in the call tree with visual indicators

### ✅ **Backend Service**
- Node.js Express server (`http://localhost:3001`)
- Endpoints:
  - `GET /api/health` - Health check
  - `GET /api/cast-check` - Verify Foundry installation
  - `POST /api/cast-run` - Execute cast run command
- Automatic Foundry availability detection
- Comprehensive error handling and logging

### ✅ **Enhanced UI/UX**
- **Smart Button Placement**: Foundry service appears only when relevant
- **Current Transaction Display**: Shows which transaction is being analyzed
- **Loading States**: Clear feedback during function resolution
- **Visual Indicators**: Resolved vs unresolved function signatures
- **Comprehensive Results**: Function count, call statistics, and detailed breakdowns

### ✅ **Bundle Integration**
- Function signatures are saved with analysis bundles
- Restored when loading saved bundles
- Persistent across sessions

## Technical Implementation

### **Frontend Changes**
- `FoundryService.tsx`: Removed manual transaction input, added contextual props
- `TransactionAnalyzer.tsx`: Integrated Foundry service after trace loading
- `App.css`: Enhanced styling for improved user experience

### **Backend Service**
- Parses `cast run` output to extract function signatures
- Maps 4-byte selectors to function names
- Returns structured data with function statistics
- Handles common DeFi function signatures

### **Function Resolution Process**
1. **Cast Execution**: `cast run <txHash> --rpc-url https://rpc.flashbots.net`
2. **Output Parsing**: Extract function calls and signatures from trace
3. **Signature Mapping**: Create 4-byte selector to function name mappings
4. **UI Integration**: Update call tree with resolved function names

## Usage

### **Prerequisites**
1. **Foundry Installation**:
   ```bash
   curl -L https://foundry.paradigm.xyz | bash
   foundryup
   ```

2. **Backend Service**:
   ```bash
   cd PoC/src/backend
   npm install
   npm start
   ```

3. **Frontend Application**:
   ```bash
   cd PoC/src/frontend
   npm start
   ```

### **Analysis Workflow**
1. Open `http://localhost:3000`
2. Enter transaction hash (e.g., Penpie hack: `0x42b2ec27c732100dd9037c76da415e10329ea41598de453bb0c0c9ea7ce0d8e5`)
3. Click "Analyze with Tenderly"
4. Wait for trace data to load
5. Click "🔍 Resolve Function Signatures" when it appears
6. View enhanced call tree with resolved function names

### **Visual Indicators**
- ✅ **Resolved Functions**: Green background, readable function names
- ❌ **Unresolved Functions**: Red background, hex signatures
- 🔨 **Foundry Indicator**: Shows functions resolved via Foundry

## Benefits

- **No API Limits**: Direct blockchain access via Foundry
- **Complete Trace Analysis**: Full transaction execution details
- **Reliable Resolution**: More accurate than third-party APIs
- **Contextual Integration**: Appears only when relevant
- **Enhanced Readability**: Human-readable function names in call tree
- **Persistent Storage**: Function signatures saved with analysis bundles

## Example Output

```
✅ Function Resolution Complete
42 function signatures resolved from 156 contract calls

Resolved Functions:
0xa9059cbb → transfer
0x23b872dd → transferFrom
0x095ea7b3 → approve
0x70a08231 → balanceOf
0xe1629e47 → batchHarvestMarketRewards
...
```

This integration significantly improves the analysis experience by providing contextual, automated function signature resolution that enhances the readability of complex DeFi transaction traces.