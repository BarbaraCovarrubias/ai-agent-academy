import React, { useState, useEffect } from 'react';
import { Database, X, Search } from 'lucide-react';

export const ChunkInspectorModal: React.FC<{ initialDocId: string; onClose: () => void }> = ({ initialDocId, onClose }) => {
  const [chunks, setChunks] = useState<any[]>([]);
  const [filter, setFilter] = useState(initialDocId);

  const loadChunks = async () => {
    const url = filter
      ? `http://localhost:8000/api/documents/chunks?document_id=${encodeURIComponent(filter)}`
      : 'http://localhost:8000/api/documents/chunks';
    const res = await fetch(url);
    if (res.ok) setChunks(await res.json());
  };

  useEffect(() => { loadChunks(); }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 p-6 font-mono text-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        <div className="h-14 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span className="font-extrabold text-sm">PGVECTOR CHUNK INSPECTOR</span>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar document_id..."
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs"
            />
            <button onClick={loadChunks} className="bg-indigo-600 px-3 py-1 rounded text-white font-bold flex items-center space-x-1">
              <Search className="w-3.5 h-3.5" /><span>Buscar</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {chunks.map((c) => (
            <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-1.5">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span className="text-indigo-400 font-bold">#{c.id} • {c.document_id} ({c.category})</span>
                <span>{c.char_count} chars (~{c.estimated_tokens} tokens)</span>
              </div>
              <p className="text-slate-200">{c.content}</p>
              <div className="text-[10px] text-cyan-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                Vector 4D: [{c.vector.join(', ')}]
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
