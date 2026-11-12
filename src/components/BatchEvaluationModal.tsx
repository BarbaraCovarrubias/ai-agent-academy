import React, { useState } from 'react';
import { FlaskConical, Play, Download, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export const BatchEvaluationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { nodes, edges } = useGameStore();
  const [report, setReport] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  const runSuite = async () => {
    setRunning(true);
    try {
      const res = await fetch('http://localhost:8000/api/batch-eval/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      if (res.ok) setReport(await res.json());
    } finally {
      setRunning(false);
    }
  };

  const exportReport = async () => {
    if (!report) return;
    const res = await fetch('http://localhost:8000/api/reports/export-ragas-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ragas_audit_${Date.now()}.html`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        <div className="h-14 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-indigo-400" />
            <span className="font-extrabold text-sm">RAGAS BATCH EVALUATION SUITE</span>
          </div>
          <div className="flex items-center space-x-2">
            {report && (
              <button onClick={exportReport} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center space-x-1">
                <Download className="w-3.5 h-3.5" /><span>Exportar Reporte</span>
              </button>
            )}
            <button onClick={runSuite} disabled={running} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg font-bold flex items-center space-x-1.5">
              <Play className="w-3.5 h-3.5" /><span>{running ? 'Evaluando...' : 'Correr Batería (5 TCs)'}</span>
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {report ? (
            <>
              <div className="grid grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
                <div><div className="text-[9px] text-slate-400">PASS RATE</div><div className="text-xl font-black text-emerald-400">{report.pass_rate_percentage}%</div></div>
                <div><div className="text-[9px] text-slate-400">FAITHFULNESS</div><div className="text-xl font-black text-white">{(report.avg_faithfulness * 100).toFixed(0)}%</div></div>
                <div><div className="text-[9px] text-slate-400">RELEVANCE</div><div className="text-xl font-black text-amber-400">{(report.avg_answer_relevance * 100).toFixed(0)}%</div></div>
                <div><div className="text-[9px] text-slate-400">PRECISION</div><div className="text-xl font-black text-cyan-400">{(report.avg_context_precision * 100).toFixed(0)}%</div></div>
              </div>

              <div className="space-y-2">
                {report.results.map((r: any) => (
                  <div key={r.test_id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 flex items-center space-x-1.5">
                        {r.status === 'PASS' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : r.status === 'WARN' ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                        <span>{r.test_id} ({r.category}): {r.query}</span>
                      </span>
                      <span className="font-bold">{(r.composite_score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-slate-300 pl-5">Respuesta: {r.generated_response}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-slate-500 py-16">Presioná "Correr Batería" para auditar el pipeline contra el Golden Dataset.</div>
          )}
        </div>
      </div>
    </div>
  );
};
