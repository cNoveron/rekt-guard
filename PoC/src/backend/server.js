const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const createKeccakHash = require('keccak');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Function to generate 4-byte selector from function signature using keccak256
function generateSelector(functionSignature) {
  const hash = createKeccakHash('keccak256').update(functionSignature).digest('hex');
  return `0x${hash.slice(0, 8)}`;
}

// Parse cast run output to extract function information
function parseCastOutput(output) {
  const contractCalls = [];
  const lines = output.split('\n');

  console.log('Parsing cast output, total lines:', lines.length);

  // Single regex to capture the cast run trace format:
  // ├─ [gas] address::functionName(params) [calltype]
  // │   ├─ [gas] address::functionName(params) [calltype]
  // Only match if functionName starts with a letter and params don't look like raw hex data
  const tracePattern = /^(\s*[│├└─\s]*)\[(\d+)\]\s+0x([0-9a-fA-F]{40})::([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)(?:\s+\[([a-zA-Z]+)\])?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(tracePattern);

    if (match) {
      const [, indentation, gas, address, functionName, params, callType] = match;

      // Skip if this looks like raw encoded data (long hex strings without spaces/commas)
      if (params && /^[0-9a-fA-F]{64,}$/.test(params.replace(/\s/g, ''))) {
        console.log(`Skipping raw encoded data: ${functionName}(${params})`);
        continue;
      }

      // Calculate depth based on indentation
      const depth = (indentation.match(/[│├└]/g) || []).length;

      // Clean up parameters (remove extra spaces and format)
      const cleanParams = params ? params.trim() : '';

      // Generate function signature and selector
      const paramTypes = cleanParameterTypes(cleanParams);

      // Skip if parameter types are invalid (start with numbers or look like hex data)
      if (paramTypes === null || (paramTypes && /^[0-9]/.test(paramTypes))) {
        console.log(`Skipping invalid parameter types: ${functionName}(${cleanParams})`);
        continue;
      }

      const fullSignature = `${functionName}(${paramTypes})`;
      const selector = generateSelector(fullSignature);

      const callInfo = {
        depth,
        type: (callType || 'CALL').toUpperCase(),
        address: `0x${address}`,
        functionName,
        fullSignature,
        selector,
        gas: `0x${parseInt(gas).toString(16)}`,
        params: cleanParams
      };

      contractCalls.push(callInfo);
    }
  }

  console.log(`Parsed ${contractCalls.length} contract calls`);

  // Convert to function signatures format for backward compatibility
  const functionSignatures = contractCalls.map(call => ({
    selector: call.selector,
    name: call.fullSignature
  }));

  // Remove duplicates from function signatures
  const uniqueSignatures = functionSignatures.filter((sig, index, self) =>
    index === self.findIndex(s => s.selector === sig.selector)
  );

  return {
    functionSignatures: uniqueSignatures,
    contractCalls,
    totalFunctions: uniqueSignatures.length,
    totalCalls: contractCalls.length
  };
}

// Helper function to clean parameter types (remove parameter names, keep only types)
function cleanParameterTypes(paramString) {
  if (!paramString || paramString.trim() === '') {
    return '';
  }

  // Check if this looks like raw encoded data (long continuous hex without proper separators)
  const cleanedForCheck = paramString.replace(/\s/g, '');
  if (/^[0-9a-fA-F]{64,}$/.test(cleanedForCheck)) {
    return null; // Signal that this should be skipped
  }

  return paramString
    .split(',')
    .map(param => {
      const trimmed = param.trim();

      // Reject parameters that are just long hex strings (likely encoded data)
      if (/^[0-9a-fA-F]{32,}$/.test(trimmed)) {
        return null;
      }

      // Handle different parameter formats from cast output:
      // - "0x1234..." -> address
      // - "123456789" or "123 [1.23e18]" -> uint256
      // - "true" or "false" -> bool
      // - "0x1234567890abcdef" (32 bytes) -> bytes32
      // - "[1,2,3]" -> array types

      if (trimmed.startsWith('0x')) {
        if (trimmed.length === 42) {
          return 'address'; // 20-byte address
        } else if (trimmed.length === 66) {
          return 'bytes32'; // 32-byte hash
        } else if (trimmed.length > 2 && trimmed.length <= 10) {
          return 'bytes'; // Short bytes data
        }
        // Skip very long hex strings as they're likely encoded data
        return null;
      }

      // Check for boolean values
      if (trimmed === 'true' || trimmed === 'false') {
        return 'bool';
      }

      // Check for numbers (including scientific notation like "123 [1.23e18]")
      if (/^\d+(\s+\[[\d.e+-]+\])?$/.test(trimmed)) {
        return 'uint256';
      }

      // Check for arrays
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return 'uint256[]'; // Assume uint256 array for now
      }

      // If it looks like a valid type already, keep it (but must start with letter)
      if (/^[a-zA-Z][a-zA-Z0-9_\[\]]*$/.test(trimmed)) {
        return trimmed;
      }

      // Default fallback - try to extract type from parameter (must start with letter)
      const typeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_\[\]]*)/);
      return typeMatch ? typeMatch[1] : null;
    })
    .filter(type => type !== null && type.length > 0)
    .join(',');
}

// Helper function to get known function signatures
function getKnownSignature(selector) {
  const commonSignatures = {
    '0xa9059cbb': 'transfer(address,uint256)',
    '0x23b872dd': 'transferFrom(address,address,uint256)',
    '0x095ea7b3': 'approve(address,uint256)',
    '0x70a08231': 'balanceOf(address)',
    '0x18160ddd': 'totalSupply()',
    '0xdd62ed3e': 'allowance(address,address)',
    '0x06fdde03': 'name()',
    '0x95d89b41': 'symbol()',
    '0x313ce567': 'decimals()',
    '0x40c10f19': 'mint(address,uint256)',
    '0x42966c68': 'burn(uint256)',
    '0x79cc6790': 'burnFrom(address,uint256)',
    '0x8da5cb5b': 'owner()',
    '0xf2fde38b': 'transferOwnership(address)',
    '0x715018a6': 'renounceOwnership()',
    '0x5c975abb': 'paused()',
    '0x8456cb59': 'pause()',
    '0x3f4ba83a': 'unpause()'
  };

  return commonSignatures[selector] || null;
}

// Endpoint to run cast command
app.post('/api/cast-run', async (req, res) => {
  const { txHash, rpcUrl = 'https://rpc.flashbots.net' } = req.body;

  if (!txHash) {
    return res.status(400).json({
      success: false,
      error: 'Transaction hash is required'
    });
  }

  // Validate transaction hash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction hash format'
    });
  }

  // Properly wrap txHash in double quotes as requested
  const command = `cast run "${txHash}" --rpc-url "${rpcUrl}" -vvvvv`;
  console.log(`Executing: ${command}`);

  exec(command, {
    timeout: 60000, // Increase timeout to 60 seconds for complex transactions
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer for large outputs
  }, (error, stdout, stderr) => {
    if (error) {
      console.error('Cast command failed:', error);
      console.error('stderr:', stderr);
      return res.json({
        success: false,
        error: `Cast command failed: ${error.message}`,
        rawOutput: stderr || error.message
      });
    }

    if (stderr && stderr.trim()) {
      console.warn('Cast command stderr:', stderr);
    }

    console.log('Cast command completed successfully');
    console.log('Output length:', stdout.length);

    try {
      // Parse the output to extract function information
      const functionInfo = parseCastOutput(stdout);

      if (functionInfo.functionSignatures.length === 0) {
        console.warn('No function signatures found in output');
        console.log('First 500 chars of output:', stdout.slice(0, 500));
      }

      res.json({
        success: true,
        functionInfo: functionInfo,
        rawOutput: stdout
      });
    } catch (parseError) {
      console.error('Failed to parse cast output:', parseError);
      res.json({
        success: false,
        error: `Failed to parse cast output: ${parseError.message}`,
        rawOutput: stdout
      });
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Foundry service is running' });
});

// Check if cast is available
app.get('/api/cast-check', (req, res) => {
  exec('cast --version', (error, stdout, stderr) => {
    if (error) {
      res.json({
        available: false,
        error: 'Cast command not found. Please install Foundry.',
        message: 'Visit https://getfoundry.sh/ to install Foundry'
      });
    } else {
      res.json({
        available: true,
        version: stdout.trim(),
        message: 'Cast is available and ready to use'
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Foundry service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Cast check: http://localhost:${PORT}/api/cast-check`);
});