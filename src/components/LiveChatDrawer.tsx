import React, { useState } from 'react';
import { Send, Bot, User, Clock, Layers } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { RagasTelemetryCard, RagasTelemetryData } from './RagasTelemetryCard';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  latency?: number;
  chunks?: string[];
  ragas?: RagasTelemetryData;
}

export const LiveChatDrawer: React.FC = () => {
  const { nodes, edges } = useGameStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Pipeline RAG conectado a pgvector. Preguntame sobre conectividad, vacaciones o seguridad.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/chat/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, nodes, edges }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.response, latency: data.latency_ms, chunks: data.context_chunks, ragas: data.ragas },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error conectando con FastAPI (localhost:8000).' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col h-full font-mono text-xs">
      <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-slate-200">Chat en Vivo & Auditoría</span>
        </div>
        <span className="text-[10px] text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">LIVE</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`p-3 rounded-xl border ${msg.role === 'user' ? 'bg-indigo-950/50 border-indigo-800/70 ml-6' : 'bg-slate-900 border-slate-800 mr-2'}`}>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span className="flex items-center space-x-1 font-bold">
                {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-emerald-400" />}
                <span>{msg.role === 'user' ? 'Empleado' : 'Agente RAG'}</span>
              </span>
              {msg.latency !== undefined && (
                <span className="flex items-center space-x-1 text-cyan-400"><Clock className="w-3 h-3" /><span>{msg.latency}ms</span></span>
              )}
            </div>
            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {msg.chunks && msg.chunks.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
                <div className="flex items-center space-x-1 text-purple-400 font-bold mb-1"><Layers className="w-3 h-3" /><span>Chunks ({msg.chunks.length})</span></div>
                {msg.chunks.map((c, i) => <div key={i} className="truncate">• {c}</div>)}
              </div>
            )}
            {msg.ragas && <RagasTelemetryCard data={msg.ragas} />}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800 flex space-x-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ej: ¿Cuál es el tope de internet?"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={sendMessage} disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 px-3 py-2 rounded-lg text-white transition">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
