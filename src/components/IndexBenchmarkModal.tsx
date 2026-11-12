import React, { useState } from 'react';
import { Scale, Play, X } from 'lucide-react';

export const IndexBenchmarkModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('¿Cuál es el tope de reintegro de internet?');
  const [efSearch, setEfSearch] = useState(40);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/vector/benchmark/hnsw-vs-knn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, ef_search: efSearch, iterations: 15 }),
      });
      if (res.ok) setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Scale className="w-5 h-5 text-indigo-400" />
            <span className="font-extrabold text-sm">BENCHMARK: HNSW vs EXACT k-NN</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2" />
          <div className="flex items-center justify-between">
            <span>hnsw.ef_search: <strong>{efSearch}</strong></span>
            <input type="range" min={10} max={200} step={10} value={efSearch} onChange={(e) => setEfSearch(Number(e.target.value))} className="w-48 accent-indigo-500" />
            <button onClick={runBenchmark} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold flex items-center space-x-1.5">
              <Play className="w-3.5 h-3.5" /><span>{loading ? 'Ejecutando...' : 'Ejecutar Test'}</span>
            </button>
          </div>
        </div>

        {result && (
          <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-slate-900 rounded-lg">
                <div className="text-slate-400 text-[10px]">Exact k-NN</div>
                <div className="text-lg font-black text-amber-400">{result.knn_exact.avg_ms} ms</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg">
                <div className="text-slate-400 text-[10px]">HNSW Index</div>
                <div className="text-lg font-black text-emerald-400">{result.hnsw_approx.avg_ms} ms</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-lg">
                <div className="text-slate-400 text-[10px]">Speedup / Recall</div>
                <div className="text-lg font-black text-indigo-400">{result.speedup_factor}x ({result.recall_at_k_percent}%)</div>
              </div>
            </div>
            <pre className="text-[10px] text-slate-400 overflow-x-auto bg-slate-900 p-2.5 rounded border border-slate-800">{result.explain_plan}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
