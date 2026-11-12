import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Trash2, Activity, X } from 'lucide-react';

export const ScaleBenchmarkModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [curve, setCurve] = useState<any | null>(null);
  const [count, setCount] = useState(25000);
  const [busy, setBusy] = useState(false);

  const loadCurve = async () => {
    const res = await fetch('http://localhost:8000/api/vector/scale/curve');
    if (res.ok) setCurve(await res.json());
  };

  useEffect(() => { loadCurve(); }, []);

  const populate = async () => {
    setBusy(true);
    try {
      await fetch('http://localhost:8000/api/vector/scale/populate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      await loadCurve();
    } finally {
      setBusy(false);
    }
  };

  const reindex = async () => {
    setBusy(true);
    try {
      const res = await fetch('http://localhost:8000/api/vector/maintenance/reindex-hnsw', { method: 'POST' });
      const data = await res.json();
      alert(`Grafo HNSW reconstruido en ${data.elapsed_seconds}s (${data.previous_size} -> ${data.current_size})`);
      await loadCurve();
    } finally {
      setBusy(false);
    }
  };

  const purge = async () => {
    setBusy(true);
    try {
      await fetch('http://localhost:8000/api/vector/scale/purge-synthetic', { method: 'DELETE' });
      await loadCurve();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="font-extrabold text-sm">ESCALABILIDAD HNSW (HASTA 100K VECTORES)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {curve && (
          <div className="grid grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
            <div><div className="text-[9px] text-slate-400">TOTAL VECTORES</div><div className="text-base font-black text-white">{curve.total_vectors.toLocaleString()}</div></div>
            <div><div className="text-[9px] text-slate-400">TAMAÑO HNSW</div><div className="text-base font-black text-purple-400">{curve.hnsw_index_size}</div></div>
            <div><div className="text-[9px] text-slate-400">HNSW LATENCY</div><div className="text-base font-black text-emerald-400">{curve.current_hnsw_ms} ms</div></div>
            <div><div className="text-[9px] text-slate-400">k-NN LATENCY</div><div className="text-base font-black text-amber-400">{curve.current_knn_ms} ms</div></div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            <option value={10000}>10.000 vectores</option>
            <option value={25000}>25.000 vectores</option>
            <option value={50000}>50.000 vectores (Dispara Auto-Reindex)</option>
          </select>
          <button onClick={populate} disabled={busy} className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-bold flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5" /><span>{busy ? 'Procesando...' : 'Generar e Indexar'}</span>
          </button>
          <button onClick={reindex} disabled={busy} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg font-bold flex items-center space-x-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" /><span>Reindexar HNSW</span>
          </button>
          <button onClick={purge} disabled={busy} className="bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 px-3 py-2 rounded-lg font-bold flex items-center space-x-1">
            <Trash2 className="w-3.5 h-3.5" /><span>Purgar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
