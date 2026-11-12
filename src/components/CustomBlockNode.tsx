import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, Cpu, Database, MessageSquareCode, Sparkles, Plug, RefreshCw, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

export const CustomBlockNode: React.FC<NodeProps> = ({ id, type, data }) => {
  const { updateNodeData, removeNode } = useGameStore();
  const [discovering, setDiscovering] = useState(false);

  const handleProviderChange = async (newProvider: string) => {
    updateNodeData(id, { provider: newProvider });
    await fetch('http://localhost:8000/api/config/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: newProvider, model: data.model }),
    }).catch(() => {});
  };

  const discoverMcpTools = async () => {
    setDiscovering(true);
    try {
      const res = await fetch('http://localhost:8000/api/mcp/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_url: data.serverUrl || 'builtin://omnicorp-erp' }),
      });
      const result = await res.json();
      if (res.ok) {
        const tools = result.tools || [];
        updateNodeData(id, {
          tools,
          selectedTool: tools.length > 0 ? tools[0].name : '',
        });
      } else {
        alert(`Error MCP: ${result.detail}`);
      }
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-xl w-64 font-mono text-xs text-slate-100 overflow-hidden">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-indigo-500" />
      <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {type === 'docLoader' && <FileText className="w-4 h-4 text-emerald-400" />}
          {type === 'embeddingGen' && <Cpu className="w-4 h-4 text-cyan-400" />}
          {type === 'pgVectorStore' && <Database className="w-4 h-4 text-purple-400" />}
          {type === 'mcpClient' && <Plug className="w-4 h-4 text-rose-400" />}
          {type === 'promptTemplate' && <MessageSquareCode className="w-4 h-4 text-amber-400" />}
          {type === 'llmNode' && <Sparkles className="w-4 h-4 text-indigo-400" />}
          <span className="font-bold text-[11px] tracking-wide">{data.label}</span>
        </div>
        <button
          onClick={() => removeNode(id)}
          className="text-slate-600 hover:text-rose-400 transition"
          title="Eliminar nodo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {type === 'docLoader' && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400 truncate">
              Fuente: <span className="text-slate-200 font-bold">{data.source || 'Sin archivo'}</span>
            </div>
            <label className="block text-center cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-2 py-1 text-[10px] text-indigo-300 font-semibold transition">
              <span>Cargar PDF al Grafo</span>
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('tenant_id', 'omnicorp');
                  formData.append('category', 'manuales');
                  const res = await fetch('http://localhost:8000/api/documents/index-pdf', {
                    method: 'POST',
                    body: formData,
                  });
                  const result = await res.json();
                  if (res.ok) {
                    updateNodeData(id, { source: file.name });
                    alert(`Indexado: ${result.chunks_created} fragmentos vectorizados.`);
                  } else {
                    alert(`Error: ${result.detail}`);
                  }
                }}
              />
            </label>
          </div>
        )}

        {type === 'embeddingGen' && (
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 block">Proveedor Embeddings:</label>
            <select
              value={data.provider || 'mock'}
              onChange={(e) => updateNodeData(id, { provider: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px]"
            >
              <option value="mock">Mock (4D Local)</option>
              <option value="openai">OpenAI (text-embedding-3-small)</option>
              <option value="ollama">Ollama (nomic-embed-text)</option>
            </select>
          </div>
        )}

        {type === 'pgVectorStore' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Index: <strong className="text-indigo-400">{data.indexType || 'HNSW'}</strong></span>
              <div className="flex items-center space-x-1">
                <span>Top-K:</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={data.topK || 3}
                  onChange={(e) => updateNodeData(id, { topK: parseInt(e.target.value) || 3 })}
                  className="w-10 bg-slate-950 border border-slate-800 rounded px-1 text-center text-cyan-400 font-bold"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-chunk-inspector', { detail: { docId: '' } }))}
              className="w-full text-center bg-purple-950/70 hover:bg-purple-900 border border-purple-800 rounded px-2 py-1 text-[10px] text-purple-200 font-semibold transition"
            >
              Inspeccionar Chunks
            </button>
          </div>
        )}

        {type === 'mcpClient' && (
          <div className="space-y-2">
            <div>
              <label className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Servidor MCP (Endpoint):</label>
              <select
                value={data.serverUrl || 'builtin://omnicorp-erp'}
                onChange={(e) => updateNodeData(id, { serverUrl: e.target.value, tools: [], selectedTool: '' })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-rose-300"
              >
                <option value="builtin://omnicorp-erp">builtin://omnicorp-erp (RRHH / IT)</option>
                <option value="builtin://devops-telemetry">builtin://devops-telemetry (EKS/Kafka)</option>
                <option value="http://localhost:3001/mcp">http://localhost:3001/mcp (Custom HTTP)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={discoverMcpTools}
              disabled={discovering}
              className="w-full flex items-center justify-center space-x-1 bg-rose-950/70 hover:bg-rose-900 border border-rose-800 rounded px-2 py-1 text-[10px] text-rose-200 font-bold transition"
            >
              <RefreshCw className={`w-3 h-3 ${discovering ? 'animate-spin' : ''}`} />
              <span>{discovering ? 'Conectando...' : 'Descubrir Tools (tools/list)'}</span>
            </button>

            {data.tools && data.tools.length > 0 && (
              <div>
                <label className="text-[9px] text-slate-400 block mb-0.5">Tool Activa ({data.tools.length} disp.):</label>
                <select
                  value={data.selectedTool || ''}
                  onChange={(e) => updateNodeData(id, { selectedTool: e.target.value })}
                  className="w-full bg-slate-950 border border-emerald-800/70 rounded px-2 py-1 text-[10px] text-emerald-300 font-bold"
                >
                  {data.tools.map((t: any) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {type === 'promptTemplate' && (
          <textarea
            rows={3}
            value={data.template || ''}
            onChange={(e) => updateNodeData(id, { template: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-amber-500"
          />
        )}

        {type === 'llmNode' && (
          <div className="space-y-1.5">
            <select
              value={data.provider || 'mock'}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px]"
            >
              <option value="mock">Simulador Mock</option>
              <option value="openai">OpenAI (GPT-4o-mini)</option>
              <option value="ollama">Ollama (Local Llama 3.2)</option>
            </select>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Temp: {data.temperature ?? 0.1}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={data.temperature ?? 0.1}
                onChange={(e) => updateNodeData(id, { temperature: parseFloat(e.target.value) })}
                className="w-24 accent-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500" />
    </div>
  );
};
