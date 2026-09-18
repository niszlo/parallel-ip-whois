import React, { useState } from 'react';
import { 
  Play, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Activity,
  Plus,
  Minus,
  RotateCw
} from 'lucide-react';
import { FormSlot, WhoisResult } from './types';
import { SlotCard } from './components/SlotCard';
import { BulkPastePanel } from './components/BulkPastePanel';
import { IP_PRESET_GROUPS } from './utils/ipPresets';
import { validateIpPrecheck } from './utils/ipValidator';

export default function App() {
  const [slotCount, setSlotCount] = useState<number>(6);
  const [slots, setSlots] = useState<FormSlot[]>([
    { id: '1', ipInput: '8.8.8.8', status: 'idle' },
    { id: '2', ipInput: '1.1.1.1', status: 'idle' },
    { id: '3', ipInput: '9.9.9.9', status: 'idle' },
    { id: '4', ipInput: '2606:4700:4700::1111', status: 'idle' },
    { id: '5', ipInput: '2001:4860:4860::8888', status: 'idle' },
    { id: '6', ipInput: '52.95.110.1', status: 'idle' },
  ]);
  const [isParallelRunning, setIsParallelRunning] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Synchronize slot list when slotCount changes
  const adjustSlotCount = (targetCount: number) => {
    const validCount = Math.max(1, Math.min(8, targetCount));
    setSlotCount(validCount);
    setSlots((prev) => {
      if (prev.length < validCount) {
        const additional: FormSlot[] = [];
        for (let i = prev.length + 1; i <= validCount; i++) {
          additional.push({
            id: String(i),
            ipInput: '',
            status: 'idle',
          });
        }
        return [...prev, ...additional];
      } else {
        return prev.slice(0, validCount);
      }
    });
  };

  const handleInputChange = (id: string, value: string) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? {
              ...slot,
              ipInput: value,
              error: undefined,
              suggestion: undefined,
              suggestedFix: undefined,
              status: slot.status === 'error' ? 'idle' : slot.status,
            }
          : slot
      )
    );
  };

  const handleClear = (id: string) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? { 
              id: slot.id, 
              ipInput: '', 
              status: 'idle', 
              result: undefined, 
              error: undefined, 
              suggestion: undefined, 
              suggestedFix: undefined 
            }
          : slot
      )
    );
  };

  const handleClearAll = () => {
    setSlots((prev) =>
      prev.map((slot) => ({
        id: slot.id,
        ipInput: '',
        status: 'idle',
        result: undefined,
        error: undefined,
        suggestion: undefined,
        suggestedFix: undefined,
      }))
    );
  };

  const handleQuickSample = (id: string, sampleIp: string) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === id
          ? { 
              ...slot, 
              ipInput: sampleIp, 
              error: undefined, 
              suggestion: undefined, 
              suggestedFix: undefined, 
              status: 'idle', 
              result: undefined 
            }
          : slot
      )
    );
  };

  const executeLookup = async (id: string, customIp?: string): Promise<void> => {
    let targetIp = (customIp !== undefined ? customIp : '').trim();
    if (!targetIp) {
      const current = slots.find((s) => s.id === id);
      targetIp = (current?.ipInput || '').trim();
    }

    if (!targetIp) return;

    // PRECHECK: Validate IP format by regex before sending any network request
    const precheck = validateIpPrecheck(targetIp);
    if (!precheck.isValid) {
      // DO NOT SEND REQUEST - Prompt user with format error and suggestion to correct entry
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ipInput: targetIp,
                status: 'error',
                error: precheck.errorMessage || 'Invalid IP format.',
                suggestion: precheck.suggestion,
                suggestedFix: precheck.suggestedFix,
                result: undefined,
              }
            : s
        )
      );
      return;
    }

    // Set slot to loading
    setSlots((prev) =>
      prev.map((s) =>
        s.id === id
          ? { 
              ...s, 
              ipInput: targetIp, 
              status: 'loading', 
              error: undefined, 
              suggestion: undefined, 
              suggestedFix: undefined, 
              startTime: Date.now() 
            }
          : s
      )
    );

    try {
      const response = await fetch(`/api/whois?ip=${encodeURIComponent(targetIp)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retrieve WHOIS data.');
      }

      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: 'success',
                result: data as WhoisResult,
                error: undefined,
                suggestion: undefined,
                suggestedFix: undefined,
              }
            : s
        )
      );
    } catch (err: any) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                status: 'error',
                error: err.message || 'Lookup failed. Please verify the address.',
                suggestion: 'Verify network connectivity or check if the target IP is reachable.',
                suggestedFix: undefined,
              }
            : s
        )
      );
    }
  };

  // Start all requests in parallel
  const handleQueryAll = async () => {
    setIsParallelRunning(true);
    const runnableSlots = slots.filter(
      (s) => s.ipInput && s.ipInput.trim().length > 0
    );

    if (runnableSlots.length === 0) {
      setIsParallelRunning(false);
      return;
    }

    await Promise.allSettled(runnableSlots.map((s) => executeLookup(s.id, s.ipInput)));
    setIsParallelRunning(false);
  };

  const applyPreset = (presetIps: string[]) => {
    const targetLength = Math.max(presetIps.length, 3);
    setSlotCount(targetLength);
    const newSlots: FormSlot[] = [];

    for (let i = 0; i < targetLength; i++) {
      newSlots.push({
        id: String(i + 1),
        ipInput: presetIps[i] || '',
        status: 'idle',
      });
    }

    setSlots(newSlots);
  };

  const handleDistributeIps = async (ips: string[], autoExecute: boolean) => {
    const targetLength = Math.max(ips.length, 6);
    setSlotCount(targetLength);
    const newSlots: FormSlot[] = [];

    for (let i = 0; i < targetLength; i++) {
      const targetIp = (ips[i] || '').trim();
      newSlots.push({
        id: String(i + 1),
        ipInput: targetIp,
        status: 'idle',
        result: undefined,
        error: undefined,
        suggestion: undefined,
        suggestedFix: undefined,
      });
    }

    setSlots(newSlots);

    if (autoExecute) {
      setIsParallelRunning(true);
      const runnable = newSlots.filter((s) => s.ipInput && s.ipInput.trim().length > 0);
      if (runnable.length > 0) {
        await Promise.allSettled(runnable.map((s) => executeLookup(s.id, s.ipInput)));
      }
      setIsParallelRunning(false);
    }
  };

  // Summary aggregation
  const completedSlots = slots.filter((s) => s.status === 'success' && s.result);
  const activeCount = slots.filter((s) => s.status === 'loading').length;
  const providersSet = Array.from(new Set(completedSlots.map((s) => s.result?.provider).filter(Boolean)));
  const countriesSet = Array.from(new Set(completedSlots.map((s) => s.result?.location.country).filter(Boolean)));

  const avgLatency = completedSlots.length > 0
    ? Math.round(completedSlots.reduce((acc, s) => acc + (s.result?.latencyMs || 0), 0) / completedSlots.length)
    : 0;

  const copyResultsTable = () => {
    if (completedSlots.length === 0) return;
    const header = '| Node | Target | Type | Provider / Hoster | Location | Range / Mask | ASN |';
    const divider = '|---|---|---|---|---|---|---|';
    const rows = completedSlots.map((s, idx) => {
      const r = s.result!;
      return `| Node ${idx + 1} | ${r.ip} | ${r.version} | ${r.provider} | ${r.location.country} (${r.location.countryCode}) | ${r.network.range} | ${r.asn?.asn ? `AS${r.asn.asn}` : 'N/A'} |`;
    });
    const markdown = [header, divider, ...rows].join('\n');
    navigator.clipboard.writeText(markdown);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const exportAsJson = () => {
    if (completedSlots.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(completedSlots.map((s) => s.result), null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `whois-diagnostics-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Determine grid columns dynamically based on slotCount
  const getGridColsClass = () => {
    if (slotCount === 1) return 'grid-cols-1 max-w-xl mx-auto';
    if (slotCount === 2) return 'grid-cols-1 md:grid-cols-2';
    if (slotCount === 3) return 'grid-cols-1 md:grid-cols-3';
    if (slotCount === 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
    if (slotCount === 5) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
    if (slotCount === 6) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6';
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4';
  };

  return (
    <div className="bg-[#0F1115] text-[#E2E8F0] min-h-screen flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header - Elegant Dark Theme */}
      <header className="px-6 lg:px-8 py-5 border-b border-[#1F2937] bg-[#111827] sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Subtitle */}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              Parallel <span className="text-blue-400">WHOIS</span>
            </h1>
            <p className="text-xs text-[#94A3B8] font-mono mt-0.5 uppercase tracking-widest">
              Multi-Threaded Network Diagnostics
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center flex-wrap gap-3">
            
            {/* System Status Pill */}
            <div className="flex items-center gap-2 bg-[#1F2937] px-3 py-1.5 rounded border border-[#374151]">
              <div className={`w-2 h-2 rounded-full ${isParallelRunning ? 'bg-blue-400 animate-ping' : 'bg-green-500'}`}></div>
              <span className="text-xs font-mono font-medium uppercase text-[#E2E8F0]">
                {isParallelRunning ? 'Processing' : 'System Ready'}
              </span>
            </div>

            {/* Slot Count Switcher */}
            <div className="flex items-center bg-[#1F2937] px-1 py-1 rounded border border-[#374151]">
              <span className="text-xs text-[#94A3B8] px-2 font-mono uppercase">
                Nodes:
              </span>
              <button
                id="slots-3-btn"
                type="button"
                onClick={() => adjustSlotCount(3)}
                className={`px-2.5 py-1 text-xs font-bold font-mono rounded transition-colors cursor-pointer ${
                  slotCount === 3
                    ? 'bg-blue-600 text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#374151]'
                }`}
              >
                03
              </button>
              <button
                id="slots-5-btn"
                type="button"
                onClick={() => adjustSlotCount(5)}
                className={`px-2.5 py-1 text-xs font-bold font-mono rounded transition-colors cursor-pointer ${
                  slotCount === 5
                    ? 'bg-blue-600 text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#374151]'
                }`}
              >
                05
              </button>
              <button
                id="slots-6-btn"
                type="button"
                onClick={() => adjustSlotCount(6)}
                className={`px-2.5 py-1 text-xs font-bold font-mono rounded transition-colors cursor-pointer ${
                  slotCount === 6
                    ? 'bg-blue-600 text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#374151]'
                }`}
              >
                06
              </button>
              <div className="flex items-center pl-1 pr-1 gap-0.5 border-l border-[#374151] ml-1">
                <button
                  id="decrease-slots-btn"
                  type="button"
                  onClick={() => adjustSlotCount(slotCount - 1)}
                  disabled={slotCount <= 1}
                  className="p-1 text-[#94A3B8] hover:text-white disabled:opacity-30 rounded cursor-pointer"
                  title="Decrease nodes"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-mono text-[#E2E8F0] px-1 font-semibold min-w-[20px] text-center">
                  {String(slotCount).padStart(2, '0')}
                </span>
                <button
                  id="increase-slots-btn"
                  type="button"
                  onClick={() => adjustSlotCount(slotCount + 1)}
                  disabled={slotCount >= 8}
                  className="p-1 text-[#94A3B8] hover:text-white disabled:opacity-30 rounded cursor-pointer"
                  title="Increase nodes"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* RUN ALL Button */}
            <button
              id="query-all-parallel-btn"
              type="button"
              onClick={handleQueryAll}
              disabled={isParallelRunning}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-[#1F2937] disabled:text-[#64748B] text-white px-4 py-2 rounded text-xs font-bold font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
            >
              {isParallelRunning ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>EXECUTING...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>RUN ALL</span>
                </>
              )}
            </button>

            {/* Clear Button */}
            <button
              id="clear-all-btn"
              type="button"
              onClick={handleClearAll}
              className="bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#94A3B8] hover:text-white px-3 py-2 rounded text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer"
              title="Clear all inputs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">RESET</span>
            </button>
          </div>
        </div>

        {/* Sample Datasets Bar */}
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-[#1F2937] flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[10px] text-[#64748B] font-mono font-bold uppercase tracking-wider shrink-0">
            Presets:
          </span>
          {IP_PRESET_GROUPS.map((group) => (
            <button
              key={group.name}
              type="button"
              onClick={() => applyPreset(group.ips)}
              className="px-2.5 py-1 text-xs font-mono text-[#94A3B8] hover:text-white bg-[#111827] hover:bg-[#1F2937] border border-[#1F2937] hover:border-[#374151] rounded transition-colors whitespace-nowrap cursor-pointer"
              title={group.description}
            >
              {group.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Grid Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-8 py-6">
        {/* Bulk Ingestion Field & Distributor */}
        <BulkPastePanel
          onDistributeIps={handleDistributeIps}
          isExecuting={isParallelRunning}
        />

        <div className={`grid gap-4 ${getGridColsClass()}`}>
          {slots.map((slot, idx) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              index={idx}
              onInputChange={handleInputChange}
              onSubmit={executeLookup}
              onClear={handleClear}
              onQuickSample={handleQuickSample}
            />
          ))}
        </div>

        {/* Diagnostics Summary Panel */}
        {completedSlots.length >= 2 && (
          <div 
            id="aggregate-summary-panel"
            className="mt-8 bg-[#111827] border border-blue-500/40 rounded-lg p-5 shadow-lg shadow-blue-900/10"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#1F2937]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                  Parallel Diagnostics Summary ({completedSlots.length} Nodes Resolved)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="copy-summary-markdown-btn"
                  type="button"
                  onClick={copyResultsTable}
                  className="px-3 py-1.5 text-xs font-mono font-medium bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#E2E8F0] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSummary ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-green-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown Table</span>
                    </>
                  )}
                </button>
                <button
                  id="export-json-btn"
                  type="button"
                  onClick={exportAsJson}
                  className="px-3 py-1.5 text-xs font-mono font-medium bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#E2E8F0] rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
              <div className="border-l-2 border-green-500 pl-3">
                <p className="text-[10px] font-mono text-[#64748B] uppercase font-bold tracking-wider mb-1">
                  Hosters & Providers
                </p>
                <div className="flex flex-wrap gap-1">
                  {providersSet.map((prov) => (
                    <span 
                      key={prov} 
                      className="px-2 py-0.5 bg-[#1F2937] border border-[#374151] text-white font-medium rounded text-[11px]"
                    >
                      {prov}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-l-2 border-green-500 pl-3">
                <p className="text-[10px] font-mono text-[#64748B] uppercase font-bold tracking-wider mb-1">
                  Countries & Jurisdictions
                </p>
                <div className="flex flex-wrap gap-1">
                  {countriesSet.map((c) => (
                    <span 
                      key={c} 
                      className="px-2 py-0.5 bg-[#1F2937] border border-[#374151] text-[#E2E8F0] font-medium rounded text-[11px]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border-l-2 border-green-500 pl-3">
                <p className="text-[10px] font-mono text-[#64748B] uppercase font-bold tracking-wider mb-1">
                  Average Query Latency
                </p>
                <span className="font-mono text-blue-400 font-bold text-sm">
                  {avgLatency}ms
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer - Elegant Dark Telemetry */}
      <footer className="px-8 py-3 bg-[#0a0f18] border-t border-[#1F2937] flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-[#475569] uppercase tracking-[0.2em] gap-2">
        <div>Engine: RFC-7480 RDAP v4.1</div>
        <div>Requests: {String(completedSlots.length).padStart(2, '0')}/{String(slotCount).padStart(2, '0')} Completed {activeCount > 0 ? `(${activeCount} Active)` : ''}</div>
        <div>Latency: {avgLatency > 0 ? `${avgLatency}ms` : 'Ready'}</div>
      </footer>
    </div>
  );
}
