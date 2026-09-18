import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  AlertCircle, 
  RotateCw, 
  Trash2, 
  ArrowRight, 
  Search, 
  HelpCircle,
  RefreshCw,
  X 
} from 'lucide-react';
import { FormSlot } from '../types';
import { detectIpType } from '../utils/ipValidator';

interface SlotCardProps {
  slot: FormSlot;
  index: number;
  onInputChange: (id: string, value: string) => void;
  onSubmit: (id: string, ipInput?: string) => void;
  onClear: (id: string) => void;
  onQuickSample: (id: string, sampleIp: string) => void;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  index,
  onInputChange,
  onSubmit,
  onClear,
  onQuickSample,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const ipType = detectIpType(slot.ipInput);
  const hasInput = slot.ipInput.trim().length > 0;
  const hasResult = slot.status === 'success' && !!slot.result;

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasInput && slot.status !== 'loading') {
      onSubmit(slot.id, slot.ipInput);
    }
  };

  const formattedNodeIndex = String(index + 1).padStart(2, '0');

  return (
    <div 
      id={`slot-card-${index + 1}`}
      className={`bg-[#111827] rounded-lg p-4 flex flex-col justify-between transition-all duration-200 min-h-[380px] border ${
        slot.status === 'loading'
          ? 'border-blue-500 shadow-lg shadow-blue-900/20 ring-1 ring-blue-500/50'
          : hasResult
          ? 'border-blue-500/50 shadow-lg shadow-blue-900/10'
          : slot.status === 'error'
          ? 'border-red-500/50 shadow-lg shadow-red-900/10'
          : 'border-[#1F2937] hover:border-[#374151]'
      }`}
    >
      <div>
        {/* Node Label Header */}
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#1F2937]">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
              hasResult || slot.status === 'loading' ? 'text-blue-400' : 'text-[#94A3B8]'
            }`}>
              Request Node {formattedNodeIndex}
            </span>
            {hasInput && (
              <span 
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                  ipType === 'IPv4'
                    ? 'bg-[#1E293B] text-blue-300 border border-blue-800/50'
                    : ipType === 'IPv6'
                    ? 'bg-[#2E1065] text-purple-300 border border-purple-800/50'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                }`}
              >
                {ipType === 'empty' ? 'Target' : ipType === 'invalid' ? 'Invalid Format' : `${ipType} Format`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {slot.result?.latencyMs !== undefined && (
              <span className="text-[10px] text-[#64748B] font-mono mr-1">
                {slot.result.latencyMs}ms
              </span>
            )}
            
            {/* Delete / Clear Button */}
            {(hasInput || hasResult || slot.error) && (
              <button
                id={`clear-btn-slot-${index + 1}`}
                type="button"
                onClick={() => onClear(slot.id)}
                aria-label={`Clear Node ${index + 1}`}
                className="text-[#94A3B8] hover:text-red-400 p-1.5 rounded hover:bg-[#1F2937] transition-colors cursor-pointer"
                title="Reset this node"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* IP Input Form */}
        <form onSubmit={handleFormSubmit} className="mb-3">
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <input
                id={`ip-input-${slot.id}`}
                type="text"
                value={slot.ipInput}
                onChange={(e) => onInputChange(slot.id, e.target.value)}
                placeholder="e.g. 1.2.3.4 or 2001:4860:4860::8888"
                disabled={slot.status === 'loading'}
                className={`w-full bg-[#1F2937] border rounded px-3 py-1.5 text-xs font-mono text-[#E2E8F0] placeholder-[#64748B] focus:outline-none transition-colors disabled:opacity-60 ${
                  slot.status === 'error'
                    ? 'border-red-500/80 focus:border-red-400 focus:ring-1 focus:ring-red-400'
                    : 'border-[#374151] focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
              />
              {slot.ipInput && (
                <button
                  type="button"
                  onClick={() => onInputChange(slot.id, '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white p-0.5 cursor-pointer"
                  title="Clear text"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            
            <button
              id={`submit-btn-slot-${index + 1}`}
              type="submit"
              disabled={!hasInput || slot.status === 'loading'}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-[#1F2937] disabled:text-[#64748B] disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-xs font-bold font-mono transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {slot.status === 'loading' ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <>
                  <span>RUN</span>
                  <ArrowRight className="w-3 h-3" />
                </>
              )}
            </button>
          </div>

          {/* Quick preset chips when empty */}
          {!hasInput && slot.status === 'idle' && (
            <div className="flex items-center gap-1.5 pt-2 flex-wrap">
              <span className="text-[10px] text-[#475569] font-mono uppercase">Quick:</span>
              {[
                index % 3 === 0 ? '8.8.8.8' : index % 3 === 1 ? '1.1.1.1' : '2606:4700::1111',
                index % 2 === 0 ? '9.9.9.9' : '2001:4860:4860::8888',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    onQuickSample(slot.id, sample);
                    onSubmit(slot.id, sample);
                  }}
                  className="text-[10px] font-mono text-[#94A3B8] hover:text-[#E2E8F0] bg-[#1F2937] hover:bg-[#374151] px-1.5 py-0.5 rounded border border-[#374151] transition-colors cursor-pointer"
                >
                  {sample}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Loading Indicator */}
        {slot.status === 'loading' && (
          <div className="mt-3 space-y-3 animate-pulse">
            <div className="border-l-2 border-blue-500/50 pl-3 py-1">
              <div className="h-2.5 bg-[#1F2937] rounded w-16 mb-2"></div>
              <div className="h-4 bg-[#1F2937] rounded w-3/4"></div>
            </div>
            <div className="border-l-2 border-blue-500/50 pl-3 py-1">
              <div className="h-2.5 bg-[#1F2937] rounded w-16 mb-2"></div>
              <div className="h-4 bg-[#1F2937] rounded w-1/2"></div>
            </div>
            <div className="border-l-2 border-blue-500/50 pl-3 py-1">
              <div className="h-2.5 bg-[#1F2937] rounded w-20 mb-2"></div>
              <div className="h-5 bg-[#1F2937] rounded w-28"></div>
            </div>
          </div>
        )}

        {/* Precheck Error or Query Error State */}
        {slot.status === 'error' && (
          <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-200 shadow-sm">
            <div className="flex items-center justify-between gap-1.5 text-red-400 font-bold mb-1.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{slot.suggestion ? 'Format Precheck' : 'Query Error'}</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-red-900/70 text-red-300 border border-red-700/60 uppercase">
                No Request Sent
              </span>
            </div>

            <p className="text-[11px] text-red-300 leading-relaxed font-mono font-medium">
              {slot.error || 'Invalid IP address.'}
            </p>

            {/* Targeted User Suggestion */}
            {slot.suggestion && (
              <div className="mt-2.5 p-2 bg-[#111827]/90 rounded border border-amber-900/50 text-[11px] text-amber-200/90 leading-normal">
                <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 font-mono mb-1">
                  <HelpCircle className="w-3 h-3 text-amber-400" />
                  <span>Suggestion to Correct Entry:</span>
                </div>
                <p className="text-[#E2E8F0] font-sans">{slot.suggestion}</p>

                {/* Actionable Quick Corrections */}
                <div className="mt-2.5 pt-2 border-t border-[#1F2937] flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] text-[#94A3B8] font-mono font-medium">Try valid format:</span>
                  {slot.suggestedFix && (
                    <button
                      type="button"
                      onClick={() => {
                        onInputChange(slot.id, slot.suggestedFix!);
                        onSubmit(slot.id, slot.suggestedFix!);
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 bg-blue-900/70 hover:bg-blue-800 border border-blue-700 text-blue-200 rounded font-bold cursor-pointer transition-colors"
                    >
                      Use {slot.suggestedFix}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onInputChange(slot.id, '1.2.3.4');
                      onSubmit(slot.id, '1.2.3.4');
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#E2E8F0] rounded cursor-pointer transition-colors"
                  >
                    1.2.3.4 (v4)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onInputChange(slot.id, '2001:4860:4860::8888');
                      onSubmit(slot.id, '2001:4860:4860::8888');
                    }}
                    className="text-[10px] font-mono px-1.5 py-0.5 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-[#E2E8F0] rounded cursor-pointer transition-colors"
                  >
                    2001:4860:4860::8888 (v6)
                  </button>
                </div>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-red-900/30">
              <button
                type="button"
                onClick={() => {
                  const inputEl = document.getElementById(`ip-input-${slot.id}`);
                  inputEl?.focus();
                }}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-bold font-mono uppercase tracking-wider cursor-pointer"
              >
                Edit Entry
              </button>
              <button
                type="button"
                onClick={() => onClear(slot.id)}
                className="text-[11px] text-[#94A3B8] hover:text-white font-mono uppercase tracking-wider cursor-pointer"
              >
                Clear Node
              </button>
            </div>
          </div>
        )}

        {/* Idle Awaiting State */}
        {slot.status === 'idle' && !hasInput && (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-2 opacity-40">
            <Search className="w-7 h-7 text-[#64748B]" />
            <p className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#64748B]">
              Awaiting Target IP
            </p>
          </div>
        )}

        {/* Completed Results Display Styled with Elegant Dark Accents */}
        {hasResult && (
          <div className="mt-2 space-y-2.5 text-[#E2E8F0]">
            
            {/* 1. PROVIDER */}
            <div className="border-l-2 border-green-500 pl-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Provider / Hoster
                </p>
                <button
                  type="button"
                  onClick={() => copyToClipboard(slot.result?.provider || '', `prov-${slot.id}`)}
                  className="text-[#64748B] hover:text-[#E2E8F0] p-0.5 rounded transition-colors cursor-pointer"
                  title="Copy provider"
                >
                  {copiedField === `prov-${slot.id}` ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="text-sm font-semibold text-white leading-tight mt-0.5 truncate" title={slot.result.provider}>
                {slot.result.provider}
              </p>
              {slot.result.asn?.asn && (
                <p className="text-[10px] font-mono text-blue-400 mt-0.5">
                  AS{slot.result.asn.asn} {slot.result.network.rir ? `[${slot.result.network.rir}]` : ''}
                </p>
              )}
            </div>

            {/* 2. LOCATION */}
            <div className="border-l-2 border-green-500 pl-3">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                Location
              </p>
              <p className="text-sm font-medium text-[#E2E8F0] leading-tight mt-0.5">
                {slot.result.location.flagEmoji ? `${slot.result.location.flagEmoji} ` : ''}
                {slot.result.location.city && slot.result.location.city !== 'Unknown City' ? `${slot.result.location.city}, ` : ''}
                {slot.result.location.country}
              </p>
              {slot.result.location.region && slot.result.location.region !== 'Unknown Region' && (
                <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">
                  {slot.result.location.region} {slot.result.location.countryCode ? `(${slot.result.location.countryCode})` : ''}
                </p>
              )}
            </div>

            {/* 3. RANGE / MASK (Netmask removed, copies pure range/mask) */}
            <div className="border-l-2 border-green-500 pl-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Range / Mask
                </p>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(slot.result?.network.range || '', `range-${slot.id}`);
                  }}
                  className="text-[#64748B] hover:text-[#E2E8F0] p-0.5 rounded transition-colors cursor-pointer"
                  title="Copy range/mask"
                >
                  {copiedField === `range-${slot.id}` ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="mt-1 flex items-center">
                <span className="text-xs font-mono bg-[#1F2937] border border-[#374151] text-blue-300 px-2 py-0.5 rounded font-medium truncate max-w-full" title={slot.result.network.range}>
                  {slot.result.network.range}
                </span>
              </div>
            </div>

            {/* Reverse DNS if available */}
            {slot.result.reverseDns && slot.result.reverseDns.length > 0 && (
              <div className="border-l-2 border-blue-500/60 pl-3 pt-0.5">
                <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-wider">
                  Reverse DNS (PTR)
                </p>
                <p className="text-[11px] font-mono text-[#94A3B8] truncate mt-0.5" title={slot.result.reverseDns[0]}>
                  {slot.result.reverseDns[0]}
                </p>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Card Footer Status & Action Toolbar */}
      <div className="mt-auto pt-3 border-t border-[#1F2937] flex items-center justify-between">
        {hasResult ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">
                Completed
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSubmit(slot.id, slot.ipInput)}
                className="text-xs font-mono text-[#94A3B8] hover:text-white flex items-center gap-1 bg-[#1F2937] hover:bg-[#374151] px-2 py-1 rounded transition-colors cursor-pointer"
                title="Restart lookup"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Restart</span>
              </button>
              <button
                type="button"
                onClick={() => onClear(slot.id)}
                className="text-xs font-mono text-red-400/80 hover:text-red-300 flex items-center gap-1 bg-[#1F2937] hover:bg-red-950/40 px-2 py-1 rounded border border-transparent hover:border-red-800/40 transition-colors cursor-pointer"
                title="Delete this request"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </>
        ) : slot.status === 'loading' ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></div>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider font-mono">
              Resolving...
            </span>
          </div>
        ) : slot.status === 'error' ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                Failed
              </span>
            </div>
            <button
              type="button"
              onClick={() => onClear(slot.id)}
              className="text-[10px] font-mono text-[#94A3B8] hover:text-white uppercase cursor-pointer"
            >
              Reset
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-[#64748B] uppercase tracking-wider">
            Ready
          </span>
        )}
      </div>
    </div>
  );
};
