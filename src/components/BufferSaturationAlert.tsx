import React, { useState, useEffect } from 'react';
import { useMaintenanceSocket } from '../hooks/useMaintenanceSocket';
import { AlertTriangle, X } from 'lucide-react';

export const BufferSaturationAlert: React.FC = () => {
  const { metrics, isBufferWarning } = useMaintenanceSocket();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isBufferWarning) setIsDismissed(false);
  }, [isBufferWarning]);

  if (!isBufferWarning || isDismissed || !metrics) return null;

  return (
    <div className="fixed top-20 right-[410px] z-50 max-w-sm w-full font-mono text-xs">
      <div className="bg-rose-950/95 border-2 border-rose-500 rounded-2xl p-4 shadow-2xl text-slate-100 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
            <div>
              <span className="text-[10px] uppercase font-black text-rose-400">Alerta I/O</span>
              <h4 className="text-xs font-bold text-white">Saturación de Buffer Pool ({metrics.buffer_hit_ratio}%)</h4>
            </div>
          </div>
          <button onClick={() => setIsDismissed(true)} className="p-1 text-rose-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-rose-200">
          PostgreSQL está leyendo bloques desde disco ({metrics.reads_per_sec} blks/s). Abrí <strong>Memory Tuner</strong> para incrementar <code>work_mem</code>.
        </p>
      </div>
    </div>
  );
};
