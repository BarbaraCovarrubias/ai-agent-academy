import React, { useState } from 'react';
import { useMaintenanceSocket } from '../hooks/useMaintenanceSocket';
import { Cpu, HardDrive, Database, ChevronUp, ChevronDown, Activity, AlertTriangle } from 'lucide-react';

export const SystemMetricsWidget: React.FC = () => {
  const { metrics, isConnected, isBufferWarning } = useMaintenanceSocket();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isConnected || !metrics) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 font-mono text-xs select-none">
      <div className={`rounded-xl shadow-2xl backdrop-blur-md overflow-hidden text-slate-100 min-w-[280px] border transition-all ${
        isBufferWarning ? 'bg-rose-950/90 border-rose-500' : 'bg-slate-900/90 border-slate-700/80'
      }`}>
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-2 bg-slate-950/80 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition border-b border-slate-800/60"
        >
          <div className="flex items-center space-x-2">
            {isBufferWarning ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" /> : <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
            <span className="font-extrabold text-[10px] uppercase text-slate-300">PG Engine Telemetry</span>
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="text-cyan-400 font-bold">{metrics.cpu_percent}% CPU</span>
            <span className={`font-bold ${isBufferWarning ? 'text-rose-300' : 'text-emerald-400'}`}>{metrics.buffer_hit_ratio}% Hit</span>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        {isExpanded && (
          <div className="p-3 space-y-3 bg-slate-900/95">
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span className="flex items-center space-x-1"><Cpu className="w-3 h-3 text-cyan-400" /><span>CPU Load</span></span>
                <span className="font-bold text-slate-200">{metrics.cpu_percent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full" style={{ width: `${Math.min(metrics.cpu_percent, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span className="flex items-center space-x-1"><HardDrive className="w-3 h-3 text-indigo-400" /><span>RAM</span></span>
                <span className="font-bold text-slate-200">{metrics.memory_used_mb} MB ({metrics.memory_percent}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full" style={{ width: `${Math.min(metrics.memory_percent, 100)}%` }} />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <div className="text-slate-500 text-[9px] uppercase font-bold flex items-center space-x-1"><Database className="w-2.5 h-2.5 text-purple-400" /><span>Disk Reads</span></div>
                <div className="text-sm font-black text-purple-300 mt-0.5">{metrics.reads_per_sec} blks/s</div>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800">
                <div className="text-slate-500 text-[9px] uppercase font-bold">Cache Hit Ratio</div>
                <div className="text-sm font-black text-emerald-400 mt-0.5">{metrics.buffer_hit_ratio}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
