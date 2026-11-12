import React from 'react';
import { FileText, Cpu, Database, MessageSquareCode, Sparkles, Plug, Trash2, RotateCcw, GripVertical } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const PALETTE_ITEMS = [
  {
    type: 'docLoader',
    label: 'Document Loader',
    desc: 'Ingesta PDF y chunking',
    icon: FileText,
    color: 'text-emerald-400',
    defaultData: { label: 'Document Loader', source: 'nuevo_manual.pdf' },
  },
  {
    type: 'embeddingGen',
    label: 'Embedding Gen',
    desc: 'Vectorización de texto',
    icon: Cpu,
    color: 'text-cyan-400',
    defaultData: { label: 'Embedding Generator', provider: 'mock', model: 'text-embedding-3-small' },
  },
  {
    type: 'pgVectorStore',
    label: 'pgvector Store',
    desc: 'Búsqueda HNSW Top-K',
    icon: Database,
    color: 'text-purple-400',
    defaultData: { label: 'pgvector HNSW Store', indexType: 'HNSW', topK: 3 },
  },
  {
    type: 'mcpClient',
    label: 'MCP Tool Client',
    desc: 'Conector Model Context Protocol',
    icon: Plug,
    color: 'text-rose-400',
    defaultData: {
      label: 'MCP Client Bridge',
      serverUrl: 'builtin://omnicorp-erp',
      tools: [],
      selectedTool: '',
    },
  },
  {
    type: 'promptTemplate',
    label: 'Prompt Template',
    desc: 'Ensamblado con guardrails',
    icon: MessageSquareCode,
    color: 'text-amber-400',
    defaultData: { label: 'Prompt Template', template: 'Contexto:\n{context}\n\nPregunta: {query}' },
  },
  {
    type: 'llmNode',
    label: 'LLM Engine',
    desc: 'OpenAI / Ollama / Mock',
    icon: Sparkles,
    color: 'text-indigo-400',
    defaultData: { label: 'LLM Engine', provider: 'mock', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 512 },
  },
];

export const NodePaletteSidebar: React.FC = () => {
  const { clearCanvas, resetDefaultPipeline } = useGameStore();

  const onDragStart = (event: React.DragEvent, item: typeof PALETTE_ITEMS[0]) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: item.type, data: item.defaultData }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-60 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-3 font-mono text-xs select-none z-10">
      <div className="space-y-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bloques Disponibles</span>
          <p className="text-[10px] text-slate-500 mt-0.5">Arrastrá nodos al canvas para armar tu arquitectura.</p>
        </div>

        <div className="space-y-2">
          {PALETTE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                className="bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/60 rounded-xl p-2.5 cursor-grab active:cursor-grabbing transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <div>
                    <div className="font-bold text-[11px] text-slate-200 group-hover:text-white">{item.label}</div>
                    <div className="text-[9px] text-slate-500">{item.desc}</div>
                  </div>
                </div>
                <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Acciones del Lienzo */}
      <div className="pt-3 border-t border-slate-800 space-y-2">
        <button
          onClick={resetDefaultPipeline}
          className="w-full flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 py-1.5 rounded-lg text-[10px] font-bold transition"
        >
          <RotateCcw className="w-3 h-3 text-indigo-400" />
          <span>Restaurar RAG Base</span>
        </button>
        <button
          onClick={clearCanvas}
          className="w-full flex items-center justify-center space-x-1.5 bg-rose-950/40 hover:bg-rose-950/80 border border-rose-900/60 text-rose-300 py-1.5 rounded-lg text-[10px] font-bold transition"
        >
          <Trash2 className="w-3 h-3" />
          <span>Vaciar Canvas</span>
        </button>
      </div>
    </aside>
  );
};
