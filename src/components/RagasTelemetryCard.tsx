import React, { useState } from 'react';
import { ShieldCheck, Award, Target, ChevronDown, ChevronUp } from 'lucide-react';

export interface RagasTelemetryData {
  faithfulness: { score: number; status: 'PASS' | 'WARN' | 'FAIL'; exp: string };
  answer_relevance: { score: number; status: 'PASS' | 'WARN' | 'FAIL'; exp: string };
  context_precision: { score: number; status: 'PASS' | 'WARN' | 'FAIL'; exp: string };
  composite: number;
}

export const RagasTelemetryCard: React.FC<{ data: RagasTelemetryData }> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = (status: string) => {
    if (status === 'PASS') return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    if (status === 'WARN') return 'text-amber-400 bg-amber-950/60 border-amber-800';
    return 'text-rose-400 bg-rose-950/60 border-rose-800';
  };

  return (
    <div className="mt-2.5 pt-2 border-t border-slate-800 font-mono text-xs select-none">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800 cursor-pointer hover:bg-slate-900 transition"
      >
        <div className="flex items-center space-x-2">
          <ShieldCheck className={`w-3.5 h-3.5 ${data.composite >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className="text-[10px] uppercase font-bold text-slate-300">RAGAS Score</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-bold text-xs text-indigo-300">{(data.composite * 100).toFixed(0)}%</span>
          {expanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800/90 space-y-2 text-[10px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center space-x-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /><span>Faithfulness</span></span>
              <span className={`px-1.5 rounded border font-bold ${getStatusBadge(data.faithfulness.status)}`}>{(data.faithfulness.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-slate-400 text-[9px] italic pl-4">{data.faithfulness.exp}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center space-x-1"><Award className="w-3 h-3 text-amber-400" /><span>Answer Relevance</span></span>
              <span className={`px-1.5 rounded border font-bold ${getStatusBadge(data.answer_relevance.status)}`}>{(data.answer_relevance.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-slate-400 text-[9px] italic pl-4">{data.answer_relevance.exp}</p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center space-x-1"><Target className="w-3 h-3 text-cyan-400" /><span>Context Precision</span></span>
              <span className={`px-1.5 rounded border font-bold ${getStatusBadge(data.context_precision.status)}`}>{(data.context_precision.score * 100).toFixed(0)}%</span>
            </div>
            <p className="text-slate-400 text-[9px] italic pl-4">{data.context_precision.exp}</p>
          </div>
        </div>
      )}
    </div>
  );
};
