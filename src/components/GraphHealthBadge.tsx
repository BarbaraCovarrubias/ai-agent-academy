import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Link2, Trash2 } from 'lucide-react';
import { GraphDiagnostic, QuickFixAction } from '../utils/graphValidator';

interface GraphHealthBadgeProps {
  diagnostics: GraphDiagnostic[];
  onApplyFix?: (fix: QuickFixAction) => void;
}

export const GraphHealthBadge: React.FC<GraphHealthBadgeProps> = ({ diagnostics, onApplyFix }) => {
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
        <div className="mt-2 bg-slate-950/95 border border-slate-700 rounded-xl p-3 shadow-2xl space-y-2.5 max-h-80 overflow-y-auto">
          {diagnostics.map((d) => (
            <div
              key={d.id}
              className={`p-2.5 rounded-lg border text-[11px] space-y-1.5 ${
                d.severity === 'error'
                  ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                  : 'bg-amber-950/30 border-amber-800/80 text-amber-200'
              }`}
            >
              <div className="font-bold flex items-center space-x-1.5">
                <span>{d.severity === 'error' ? '❌' : '⚠️'}</span>
                <span>{d.message}</span>
              </div>
              <p className="text-[10px] text-slate-300 pl-5">💡 {d.fixHint}</p>

              {d.quickFixes && d.quickFixes.length > 0 && onApplyFix && (
                <div className="pl-5 pt-1 flex flex-wrap gap-1.5">
                  {d.quickFixes.map((fix, idx) => (
                    <button
                      key={idx}
                      onClick={() => onApplyFix(fix)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                        fix.actionType === 'connect'
                          ? 'bg-sky-600/90 hover:bg-sky-500 text-white border border-sky-400/50'
                          : 'bg-slate-800 hover:bg-rose-900/70 text-slate-300 hover:text-rose-200 border border-slate-600'
                      }`}
                    >
                      {fix.actionType === 'connect' ? (
                        <Link2 className="w-3 h-3" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>{fix.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
