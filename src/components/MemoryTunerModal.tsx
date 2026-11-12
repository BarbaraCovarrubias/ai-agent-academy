import React, { useState, useEffect } from 'react';
import { Sliders, Sparkles, CheckCircle2, X } from 'lucide-react';

export const MemoryTunerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [statusData, setStatusData] = useState<any | null>(null);
  const [plan, setPlan] = useState<any | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = async () => {
    const [resCur, resPlan] = await Promise.all([
      fetch('http://localhost:8000/api/vector/tuning/current'),
      fetch('http://localhost:8000/api/vector/auto-tune/plan'),
    ]);
    if (resCur.ok) setStatusData(await resCur.json());
    if (resPlan.ok) setPlan(await resPlan.json());
  };

  useEffect(() => { loadAll(); }, []);

  const applyAutoTune = async () => {
    const res = await fetch('http://localhost:8000/api/vector/auto-tune/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply_session_only: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message);
      await loadAll();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-sm">POSTGRESQL MEMORY AUTO-TUNER</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {statusData && (
          <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-center">
            <div><div className="text-[9px] text-slate-500">work_mem</div><div className="font-bold text-cyan-400">{statusData.active_settings?.work_mem?.current_value}</div></div>
            <div><div className="text-[9px] text-slate-500">shared_buffers</div><div className="font-bold text-purple-400">{statusData.active_settings?.shared_buffers?.current_value}</div></div>
            <div><div className="text-[9px] text-slate-500">hnsw.ef_search</div><div className="font-bold text-emerald-400">{statusData.active_settings?.['hnsw.ef_search']?.current_value || '40'}</div></div>
          </div>
        )}

        {plan && (
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/40 space-y-3">
            <div className="text-slate-300">
              Hardware detectado: <strong>{plan.host_profile.total_ram_gb} GB RAM</strong> • <strong>{plan.host_profile.cpu_cores_logical} hilos</strong> ({plan.host_profile.os_name})
            </div>
            <div className="text-[11px] text-indigo-300">
              Recomendado: <code>work_mem = {plan.recommended_config.work_mem}</code> | <code>ef_search = {plan.recommended_config.hnsw_ef_search}</code>
            </div>
            <button onClick={applyAutoTune} className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-bold flex items-center justify-center space-x-1.5">
              <Sparkles className="w-4 h-4" /><span>Aplicar Auto-Tuning Óptimo</span>
            </button>
          </div>
        )}

        {msg && (
          <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-lg text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" /><span>{msg}</span>
          </div>
        )}
      </div>
    </div>
  );
};
