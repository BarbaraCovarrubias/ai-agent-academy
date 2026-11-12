import React, { useState, useEffect } from 'react';
import { useMaintenanceSocket } from '../hooks/useMaintenanceSocket';
import { Activity, CheckCircle2, AlertOctagon, Wifi, WifiOff, X } from 'lucide-react';

export const MaintenanceLiveBanner: React.FC = () => {
  const { isConnected, lastEvent } = useMaintenanceSocket();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (lastEvent && lastEvent.type !== 'STATUS_INIT') {
      setShowNotification(true);
      if (lastEvent.type === 'REINDEX_COMPLETED') {
        const timer = setTimeout(() => setShowNotification(false), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [lastEvent]);

  return (
    <>
      <div className="fixed bottom-4 right-[405px] z-40 flex items-center space-x-1.5 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-full font-mono text-[9px] text-slate-400 backdrop-blur shadow">
        {isConnected ? (
          <><Wifi className="w-3 h-3 text-emerald-400" /><span>Telemetry Live</span></>
        ) : (
          <><WifiOff className="w-3 h-3 text-rose-400" /><span>Reconectando WS...</span></>
        )}
      </div>

      {showNotification && lastEvent && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 font-mono text-xs">
          <div className={`px-4 py-2.5 rounded-xl border shadow-2xl flex items-center space-x-3 backdrop-blur-md text-slate-100 ${
            lastEvent.type === 'REINDEX_STARTED' ? 'bg-amber-950/80 border-amber-500/80'
              : lastEvent.type === 'REINDEX_COMPLETED' ? 'bg-emerald-950/80 border-emerald-500/80'
              : 'bg-rose-950/80 border-rose-500/80'
          }`}>
            {lastEvent.type === 'REINDEX_STARTED' && <Activity className="w-4 h-4 text-amber-400 animate-spin" />}
            {lastEvent.type === 'REINDEX_COMPLETED' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {lastEvent.type === 'REINDEX_FAILED' && <AlertOctagon className="w-4 h-4 text-rose-400" />}
            <div className="flex flex-col">
              <span className="font-bold text-[11px]">Mantenimiento HNSW</span>
              <span className="text-[10px] text-slate-300">{lastEvent.message || lastEvent.error}</span>
            </div>
            <button onClick={() => setShowNotification(false)} className="p-1 hover:bg-white/10 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}
    </>
  );
};
