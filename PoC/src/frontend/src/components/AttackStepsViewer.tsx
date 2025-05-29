import React, { useState, useMemo } from 'react';

interface AttackStepsViewerProps {
  debuggerTrace: any;
  selectedStep: number;
  onStepSelect: (step: number) => void;
}

interface TraceStep {
  pc: number;
  op: string;
  depth: number;
  gas: number;
  gasCost: number;
  memory?: string[];
  stack?: string[];
  storage?: Record<string, string>;
  address?: string;
  input?: string;
  output?: string;
}

export const AttackStepsViewer: React.FC<AttackStepsViewerProps> = ({
  debuggerTrace,
  selectedStep,
  onStepSelect
}) => {
  const [filter, setFilter] = useState('');
  const [showCallsOnly, setShowCallsOnly] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(0);

  const trace: TraceStep[] = useMemo(() => {
    return debuggerTrace?.trace || [];
  }, [debuggerTrace]);

  const filteredTrace = useMemo(() => {
    let filtered = trace;

    if (showCallsOnly) {
      filtered = filtered.filter(step =>
        ['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL', 'CREATE', 'CREATE2'].includes(step.op)
      );
    }

    if (filter) {
      filtered = filtered.filter(step =>
        step.op.toLowerCase().includes(filter.toLowerCase()) ||
        step.address?.toLowerCase().includes(filter.toLowerCase())
      );
    }

    return filtered;
  }, [trace, filter, showCallsOnly]);

  const paginatedTrace = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredTrace.slice(start, start + pageSize);
  }, [filteredTrace, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTrace.length / pageSize);

  const getStepType = (op: string): string => {
    if (['CALL', 'CALLCODE', 'DELEGATECALL', 'STATICCALL'].includes(op)) return 'call';
    if (['SLOAD', 'SSTORE'].includes(op)) return 'storage';
    if (['MLOAD', 'MSTORE', 'MSTORE8'].includes(op)) return 'memory';
    if (['PUSH1', 'PUSH2', 'PUSH4', 'PUSH32'].includes(op)) return 'push';
    if (['POP', 'DUP1', 'SWAP1'].includes(op)) return 'stack';
    if (['REVERT', 'RETURN'].includes(op)) return 'return';
    return 'other';
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const identifyAttackStep = (step: TraceStep, index: number): string => {
    // This is a simplified heuristic to identify key attack steps
    if (step.op === 'CALL' && step.address) {
      const addr = step.address.toLowerCase();

      // Balancer flash loan
      if (addr === '0xba12222222228d8ba445958a75a0704d566bf2c8') {
        return 'Flash Loan from Balancer';
      }

      // Pendle Staking
      if (addr === '0x6e799758cee75dae3d84e09d40dc416ecf713652') {
        return 'Pendle Staking Interaction';
      }

      // Master Penpie
      if (addr === '0x16296859c15289731521f199f0a5f762df6347d0') {
        return 'Master Penpie Interaction';
      }

      // Attacker contract
      if (addr === '0x4476b6ca46b28182944ed750e74e2bb1752f87ae') {
        return 'Attacker Contract Call';
      }
    }

    return '';
  };

  if (!debuggerTrace) {
    return (
      <div className="attack-steps-viewer">
        <h2>Attack Execution Steps</h2>
        <div className="no-trace">
          <p>No trace data available. Please run the transaction analysis first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="attack-steps-viewer">
      <div className="steps-header">
        <h2>Attack Execution Steps</h2>

        <div className="controls">
          <div className="filter-controls">
            <input
              type="text"
              placeholder="Filter by opcode or address..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-input"
            />

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showCallsOnly}
                onChange={(e) => setShowCallsOnly(e.target.checked)}
              />
              Show only CALL operations
            </label>
          </div>

          <div className="pagination-controls">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>

            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </button>

            <span>
              Page {currentPage + 1} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div className="trace-stats">
        <div className="stat-item">
          <strong>Total Steps:</strong> {trace.length.toLocaleString()}
        </div>
        <div className="stat-item">
          <strong>Filtered Steps:</strong> {filteredTrace.length.toLocaleString()}
        </div>
        <div className="stat-item">
          <strong>Max Depth:</strong> {Math.max(...trace.map(s => s.depth))}
        </div>
      </div>

      <div className="steps-table">
        <div className="table-header">
          <div className="col-step">#</div>
          <div className="col-opcode">Opcode</div>
          <div className="col-depth">Depth</div>
          <div className="col-gas">Gas</div>
          <div className="col-address">Address</div>
          <div className="col-context">Context</div>
        </div>

        <div className="table-body">
          {paginatedTrace.map((step, index) => {
            const actualIndex = currentPage * pageSize + index;
            const attackStep = identifyAttackStep(step, actualIndex);

            return (
              <div
                key={actualIndex}
                className={`table-row ${selectedStep === actualIndex ? 'selected' : ''} ${getStepType(step.op)}`}
                onClick={() => onStepSelect(actualIndex)}
              >
                <div className="col-step">{actualIndex}</div>
                <div className="col-opcode">
                  <span className={`opcode ${getStepType(step.op)}`}>
                    {step.op}
                  </span>
                </div>
                <div className="col-depth">
                  <div
                    className="depth-indicator"
                    style={{ marginLeft: `${step.depth * 10}px` }}
                  >
                    {step.depth}
                  </div>
                </div>
                <div className="col-gas">
                  {step.gas?.toLocaleString()}
                  {step.gasCost && (
                    <span className="gas-cost">(-{step.gasCost})</span>
                  )}
                </div>
                <div className="col-address">
                  {step.address && (
                    <code title={step.address}>
                      {formatAddress(step.address)}
                    </code>
                  )}
                </div>
                <div className="col-context">
                  {attackStep && (
                    <span className="attack-step">{attackStep}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedStep < trace.length && (
        <div className="step-details">
          <h3>Step {selectedStep} Details</h3>

          <div className="step-info">
            <div className="info-grid">
              <div className="info-item">
                <strong>Opcode:</strong> {trace[selectedStep]?.op}
              </div>
              <div className="info-item">
                <strong>Program Counter:</strong> {trace[selectedStep]?.pc}
              </div>
              <div className="info-item">
                <strong>Gas Remaining:</strong> {trace[selectedStep]?.gas?.toLocaleString()}
              </div>
              <div className="info-item">
                <strong>Gas Cost:</strong> {trace[selectedStep]?.gasCost}
              </div>
              <div className="info-item">
                <strong>Depth:</strong> {trace[selectedStep]?.depth}
              </div>
              {trace[selectedStep]?.address && (
                <div className="info-item">
                  <strong>Address:</strong>
                  <code>{trace[selectedStep].address}</code>
                </div>
              )}
            </div>

            {trace[selectedStep]?.input && (
              <div className="input-data">
                <strong>Input:</strong>
                <pre>{trace[selectedStep].input}</pre>
              </div>
            )}

            {trace[selectedStep]?.output && (
              <div className="output-data">
                <strong>Output:</strong>
                <pre>{trace[selectedStep].output}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="legend">
        <h4>Opcode Types</h4>
        <div className="legend-items">
          <span className="legend-item call">CALL operations</span>
          <span className="legend-item storage">Storage operations</span>
          <span className="legend-item memory">Memory operations</span>
          <span className="legend-item push">Stack push</span>
          <span className="legend-item stack">Stack manipulation</span>
          <span className="legend-item return">Return/Revert</span>
          <span className="legend-item other">Other</span>
        </div>
      </div>
    </div>
  );
};