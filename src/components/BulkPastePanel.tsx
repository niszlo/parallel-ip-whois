import React, { useState, useMemo } from 'react';
import { 
  Clipboard, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Play, 
  X, 
  Sparkles, 
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { parseAndValidateBulkIps } from '../utils/ipValidator';

interface BulkPastePanelProps {
  onDistributeIps: (ips: string[], autoExecute: boolean) => void;
  isExecuting?: boolean;
}

const SAMPLE_6_IPS = `8.8.8.8
1.1.1.1
9.9.9.9
2606:4700:4700::1111
2001:4860:4860::8888
52.95.110.1`;

export const BulkPastePanel: React.FC<BulkPastePanelProps> = ({
  onDistributeIps,
  isExecuting = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [rawText, setRawText] = useState<string>('');
  const [justDistributed, setJustDistributed] = useState<boolean>(false);

  // Live real-time parsing and validation of up to 6 IPs
  const parsedData = useMemo(() => {
    return parseAndValidateBulkIps(rawText, 6);
  }, [rawText]);

  const handleApply = (autoExecute = false) => {
    if (parsedData.items.length === 0) return;
    
    // Extract IP list (valid or raw cleaned)
    const ipList = parsedData.items.map((i) => i.cleaned || i.original);
    onDistributeIps(ipList, autoExecute);
    
    setJustDistributed(true);
    setTimeout(() => setJustDistributed(false), 2200);
  };

  const handleInsertSample = () => {
    setRawText(SAMPLE_6_IPS);
  };

  const handleClear = () => {
    setRawText('');
  };

  return (
    <div className="mb-6 bg-[#111827] border border-[#1F2937] rounded-lg shadow-lg overflow-hidden transition-all">
      {/* Header Bar / Toggle */}
      <div 
        className="px-4 py-3 bg-[#131B2E] border-b border-[#1F2937] flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-950/80 border border-blue-800/60 rounded text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-white">
                Multi-IP Ingestion & Node Distributor
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/50">
                Paste 6 IPs (1 per Node)
              </span>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Paste up to 6 IPv4/IPv6 addresses to pre-validate and allocate 1 IP per diagnostic node.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {rawText && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                parsedData.invalidCount === 0 && parsedData.validCount > 0
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : parsedData.invalidCount > 0
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                  : 'bg-[#1F2937] text-[#94A3B8]'
              }`}>
                {parsedData.validCount}/6 Valid
              </span>
            </div>
          )}
          <button
            type="button"
            className="text-[#94A3B8] hover:text-white p-1 rounded transition-colors"
            title={isOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Text Area Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
              <label 
                htmlFor="bulk-ip-textarea"
                className="text-[#94A3B8] font-medium flex items-center gap-1.5"
              >
                <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                <span>Paste IP List (Separated by newlines, commas, spaces, or semicolons):</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInsertSample}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Fill with 6 sample addresses"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sample 6 IPs</span>
                </button>
                {rawText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] text-[#94A3B8] hover:text-white flex items-center gap-1 transition-colors cursor-pointer ml-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="bulk-ip-textarea"
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && parsedData.canSend) {
                  e.preventDefault();
                  handleApply(true);
                }
              }}
              placeholder="Paste up to 6 IPs here... Example:
8.8.8.8
1.1.1.1
9.9.9.9
2606:4700:4700::1111
2001:4860:4860::8888
52.95.110.1"
              className="w-full bg-[#0B0F19] border border-[#1F2937] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md p-3 text-xs font-mono text-[#E2E8F0] placeholder-[#475569] leading-relaxed transition-colors resize-y"
            />
          </div>

          {/* Real-Time Precheck Live Preview Chips */}
          {parsedData.items.length > 0 && (
            <div className="bg-[#0B0F19] border border-[#1F2937] rounded-md p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#94A3B8] font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span>Precheck Validation:</span>
                  <span className="text-white bg-[#1F2937] px-1.5 py-0.2 rounded font-mono">
                    {parsedData.items.length} Target{parsedData.items.length === 1 ? '' : 's'} Detected
                  </span>
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-400 font-medium">✓ {parsedData.validCount} Valid Format</span>
                  {parsedData.invalidCount > 0 && (
                    <span className="text-red-400 font-medium">✕ {parsedData.invalidCount} Invalid</span>
                  )}
                </div>
              </div>

              {/* Grid of Parsed Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {parsedData.items.map((item, idx) => {
                  const isValid = item.precheck.isValid;
                  const version = item.precheck.version;

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded border flex flex-col justify-between text-xs font-mono transition-all ${
                        isValid
                          ? 'bg-[#111827] border-blue-900/50 hover:border-blue-700/70'
                          : 'bg-red-950/30 border-red-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1F2937] text-blue-300 border border-[#374151]">
                            Node 0{idx + 1}
                          </span>
                          <span className="text-[#E2E8F0] font-bold truncate max-w-[140px]" title={item.original}>
                            {item.cleaned || item.original}
                          </span>
                        </div>

                        {isValid ? (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            version === 'IPv4'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}>
                            {version}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase bg-red-950 text-red-300 border border-red-800 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Format Err
                          </span>
                        )}
                      </div>

                      {/* Error or Suggestion */}
                      {!isValid && (
                        <p className="text-[10px] text-red-300/90 mt-1 leading-tight font-sans">
                          {item.precheck.suggestion || item.precheck.errorMessage}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Warning if more than 6 were pasted */}
              {parsedData.totalParsed > 6 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 pt-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>The system will distribute the first 6 IPs into Nodes 1 to 6. Extra items are ignored.</span>
                </div>
              )}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-[#64748B] font-mono">
              Press <kbd className="px-1.5 py-0.5 bg-[#1F2937] text-[#E2E8F0] rounded border border-[#374151]">Ctrl+Enter</kbd> to distribute & run
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              {justDistributed && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-pulse">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Distributed to Nodes!
                </span>
              )}

              {/* Populate Only Button */}
              <button
                type="button"
                id="distribute-ips-btn"
                onClick={() => handleApply(false)}
                disabled={!parsedData.canSend || isExecuting}
                className="px-3.5 py-2 bg-[#1F2937] hover:bg-[#374151] disabled:bg-[#111827] disabled:text-[#475569] text-[#E2E8F0] border border-[#374151] rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Populate IPs into the 6 node slots"
              >
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                <span>Distribute 1 per Node</span>
              </button>

              {/* Populate & Run All Button */}
              <button
                type="button"
                id="distribute-and-run-btn"
                onClick={() => handleApply(true)}
                disabled={!parsedData.canSend || isExecuting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1F2937] disabled:text-[#475569] text-white rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-colors cursor-pointer"
                title="Populate into 6 nodes and immediately run parallel lookups"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Send 1 per Node & Run All</span>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
