import React, { useMemo, useState } from 'react';

interface MemoryViewerProps {
  debuggerTrace: any;
  selectedStep: number;
}

export const MemoryViewer: React.FC<MemoryViewerProps> = ({
  debuggerTrace,
  selectedStep
}) => {
  const [displayFormat, setDisplayFormat] = useState<'hex' | 'ascii' | 'utf8'>('hex');
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightChanges, setHighlightChanges] = useState(true);

  const currentStep = useMemo(() => {
    if (!debuggerTrace?.trace || selectedStep >= debuggerTrace.trace.length) {
      return null;
    }
    return debuggerTrace.trace[selectedStep];
  }, [debuggerTrace, selectedStep]);

  const previousStep = useMemo(() => {
    if (!debuggerTrace?.trace || selectedStep <= 0) {
      return null;
    }
    return debuggerTrace.trace[selectedStep - 1];
  }, [debuggerTrace, selectedStep]);

  const parseMemory = (memoryArray: string[]): string => {
    if (!memoryArray || memoryArray.length === 0) {
      return '';
    }
    return memoryArray.join('');
  };

  const formatMemoryChunk = (chunk: string, format: 'hex' | 'ascii' | 'utf8'): string => {
    if (!chunk) return '';

    switch (format) {
      case 'hex':
        return chunk.match(/.{1,2}/g)?.join(' ') || chunk;
      case 'ascii':
        try {
          return chunk.match(/.{1,2}/g)
            ?.map(hex => {
              const code = parseInt(hex, 16);
              return code >= 32 && code <= 126 ? String.fromCharCode(code) : '.';
            })
            .join('') || '';
        } catch {
          return '';
        }
      case 'utf8':
        try {
          const bytes = chunk.match(/.{1,2}/g)?.map(hex => parseInt(hex, 16)) || [];
          return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
        } catch {
          return '';
        }
      default:
        return chunk;
    }
  };

  const getChangedMemoryRegions = (current: string, previous: string): number[] => {
    if (!current || !previous) return [];

    const changes: number[] = [];
    const chunkSize = 64; // 32 bytes = 64 hex characters

    for (let i = 0; i < Math.max(current.length, previous.length); i += chunkSize) {
      const currentChunk = current.slice(i, i + chunkSize);
      const previousChunk = previous.slice(i, i + chunkSize);

      if (currentChunk !== previousChunk) {
        changes.push(Math.floor(i / chunkSize));
      }
    }

    return changes;
  };

  const findInMemory = (memory: string, searchTerm: string): number[] => {
    if (!memory || !searchTerm) return [];

    const matches: number[] = [];
    const normalizedSearch = searchTerm.replace(/0x/i, '').toLowerCase();
    const normalizedMemory = memory.toLowerCase();

    let index = normalizedMemory.indexOf(normalizedSearch);
    while (index !== -1) {
      matches.push(index);
      index = normalizedMemory.indexOf(normalizedSearch, index + 1);
    }

    return matches;
  };

  const analyzeMemoryContent = (memory: string): any[] => {
    if (!memory) return [];

    const analysis = [];
    const chunkSize = 64; // 32 bytes

    for (let i = 0; i < memory.length; i += chunkSize) {
      const chunk = memory.slice(i, i + chunkSize);
      const offset = i / 2; // Convert hex chars to byte offset

      let interpretation = '';

      // Try to identify common patterns
      if (chunk.startsWith('000000000000000000000000')) {
        const addr = chunk.slice(24);
        if (addr.length === 40 && parseInt(addr, 16) > 0) {
          interpretation = `Address: 0x${addr}`;
        }
      } else if (chunk.match(/^[0-9a-f]{64}$/i) && !chunk.match(/^0+$/)) {
        const value = BigInt('0x' + chunk);
        if (value > 0) {
          interpretation = `uint256: ${value.toString()}`;

          // Check if it looks like a token amount (18 decimals)
          if (value > BigInt(10 ** 15) && value < BigInt(10 ** 25)) {
            const ethValue = Number(value) / (10 ** 18);
            interpretation += ` (${ethValue.toFixed(6)} ETH)`;
          }
        }
      }

      analysis.push({
        offset,
        chunk,
        interpretation,
        isEmpty: chunk.match(/^0+$/) !== null
      });
    }

    return analysis;
  };

  if (!debuggerTrace) {
    return (
      <div className="memory-viewer">
        <h2>Memory Analysis</h2>
        <p>No trace data available. Please run the transaction analysis first.</p>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="memory-viewer">
        <h2>Memory Analysis</h2>
        <p>Select a step from the Attack Steps viewer to see memory state.</p>
      </div>
    );
  }

  const currentMemory = parseMemory(currentStep.memory || []);
  const previousMemory = parseMemory(previousStep?.memory || []);
  const changedRegions = highlightChanges ? getChangedMemoryRegions(currentMemory, previousMemory) : [];
  const searchMatches = findInMemory(currentMemory, searchTerm);
  const memoryAnalysis = analyzeMemoryContent(currentMemory);

  return (
    <div className="memory-viewer">
      <div className="viewer-header">
        <h2>Memory Analysis - Step {selectedStep}</h2>

        <div className="memory-controls">
          <div className="format-controls">
            <label>Display Format:</label>
            <select
              value={displayFormat}
              onChange={(e) => setDisplayFormat(e.target.value as 'hex' | 'ascii' | 'utf8')}
            >
              <option value="hex">Hexadecimal</option>
              <option value="ascii">ASCII</option>
              <option value="utf8">UTF-8</option>
            </select>
          </div>

          <div className="search-controls">
            <input
              type="text"
              placeholder="Search in memory (hex or text)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchMatches.length > 0 && (
              <span className="search-results">{searchMatches.length} matches</span>
            )}
          </div>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={highlightChanges}
              onChange={(e) => setHighlightChanges(e.target.checked)}
            />
            Highlight changes from previous step
          </label>
        </div>
      </div>

      <div className="memory-stats">
        <div className="stat-item">
          <strong>Memory Size:</strong> {currentMemory.length / 2} bytes ({currentMemory.length} hex chars)
        </div>
        <div className="stat-item">
          <strong>Non-zero Regions:</strong> {memoryAnalysis.filter(a => !a.isEmpty).length}
        </div>
        {changedRegions.length > 0 && (
          <div className="stat-item">
            <strong>Changed Regions:</strong> {changedRegions.length}
          </div>
        )}
      </div>

      {currentMemory.length === 0 ? (
        <div className="empty-memory">
          <h3>Memory is Empty</h3>
          <p>No memory has been allocated at this step.</p>
        </div>
      ) : (
        <div className="memory-content">
          <div className="memory-analysis">
            <h3>Memory Content Analysis</h3>
            <div className="analysis-table">
              <div className="analysis-header">
                <div className="col-offset">Offset</div>
                <div className="col-data">Data (32 bytes)</div>
                <div className="col-interpretation">Interpretation</div>
              </div>

              <div className="analysis-body">
                {memoryAnalysis.map((item, index) => {
                  const isChanged = changedRegions.includes(index);
                  const hasMatches = searchMatches.some(match =>
                    match >= index * 64 && match < (index + 1) * 64
                  );

                  if (item.isEmpty && !isChanged && !hasMatches) {
                    return null; // Skip empty regions unless they changed or have matches
                  }

                  return (
                    <div
                      key={index}
                      className={`analysis-row ${isChanged ? 'changed' : ''} ${hasMatches ? 'has-match' : ''}`}
                    >
                      <div className="col-offset">
                        0x{item.offset.toString(16).padStart(4, '0')}
                      </div>
                      <div className="col-data">
                        <code className="memory-chunk">
                          {formatMemoryChunk(item.chunk, displayFormat)}
                        </code>
                        {isChanged && <span className="change-indicator">✧</span>}
                      </div>
                      <div className="col-interpretation">
                        {item.interpretation || (item.isEmpty ? 'Empty (all zeros)' : 'Raw data')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="raw-memory">
            <h3>Raw Memory Dump</h3>
            <div className="memory-dump">
              <pre className="memory-hex">
                {currentMemory.match(/.{1,64}/g)?.map((line, index) => {
                  const offset = index * 32;
                  const isChanged = changedRegions.includes(index);
                  const hasMatches = searchMatches.some(match =>
                    match >= index * 64 && match < (index + 1) * 64
                  );

                  return (
                    <div
                      key={index}
                      className={`memory-line ${isChanged ? 'changed' : ''} ${hasMatches ? 'has-match' : ''}`}
                    >
                      <span className="offset">
                        {offset.toString(16).padStart(4, '0')}:
                      </span>
                      <span className="data">
                        {formatMemoryChunk(line, displayFormat)}
                      </span>
                    </div>
                  );
                }).join('')}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="memory-context">
        <h4>Memory in the Penpie Attack</h4>
        <div className="context-content">
          <p>
            EVM memory is used for temporary data storage during contract execution.
            In the context of the Penpie attack, memory contains:
          </p>
          <ul>
            <li><strong>Function Parameters:</strong> Arguments passed to functions during calls</li>
            <li><strong>Return Data:</strong> Results from function calls that will be returned</li>
            <li><strong>Temporary Variables:</strong> Intermediate calculations and data manipulation</li>
            <li><strong>Array Data:</strong> Dynamic arrays used in the attack (token addresses, amounts)</li>
          </ul>
          <p>
            Key patterns to look for:
          </p>
          <ul>
            <li><strong>Addresses:</strong> Contract addresses involved in the attack</li>
            <li><strong>Token Amounts:</strong> Large numbers representing token quantities</li>
            <li><strong>Function Selectors:</strong> 4-byte signatures for function calls</li>
            <li><strong>Array Lengths:</strong> Numbers indicating array sizes</li>
          </ul>
        </div>
      </div>

      {changedRegions.length > 0 && (
        <div className="memory-changes">
          <h4>Memory Changes from Previous Step</h4>
          <p>
            Regions marked with ✧ have changed from the previous execution step.
            This helps track how the attack manipulates data during execution.
          </p>
        </div>
      )}
    </div>
  );
};