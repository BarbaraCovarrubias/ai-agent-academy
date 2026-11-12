import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { GraphDiagnostic } from '../utils/graphValidator';

export const GraphHealthBadge: React.FC<{ diagnostics: GraphDiagnostic[] }> = ({ diagnostics }) => {
  const [open, setOpen] = useState(false);

  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const isHealthy = errors.length === 0 && warnings.length === 0;

  return (
    <div className="absolute top-3 left-3 z-30 font-mono text-xs max-w-md">
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-xl border shadow-lg backdrop-blur-md flex items-center space-x-2 transition ${
          errors.length > 0
            ? 'bg-rose-950/90 border-rose-500 text-rose-200'
            : warnings.length > 0
            ? 'bg-amber-950/90 border-amber-500 text-amber-200'
            : 'bg-emerald-950/85 border-emerald-600/70 text-emerald-300'
        }`}
      >
        {errors.length > 0 ? (
          <XCircle className="w-4 h-4 text-rose-400 animate-pulse" />
        ) : warnings.length > 0 ? (
          <AlertTriangle className="w-4 h-4 text-amber-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}

        <span className="font-bold text-[11px]">
          {isHealthy
            ? 'Grafo Válido (DAG OK)'
            : `${errors.length} Error(es) • ${warnings.length} Advertencia(s)`}
        </span>

        {!isHealthy && (open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
      </button>

      {open && !isHealthy && (
        <div className="mt-2 bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-2.5 max-h-72 overflow-y-auto">
          {diagnostics.map((d) => (
            <div
              key={d.id}
              className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                d.severity === 'error'
                  ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                  : 'bg-amber-950/30 border-amber-800/80 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center space-x-1.5">
                <span>{d.severity === 'error' ? '❌' : '⚠️'}</span>
                <span>{d.message}</span>
              </div>
              <p className="text-[10px] text-slate-400 pl-5">💡 {d.fixHint}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
