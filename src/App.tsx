import React, { useState, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import { Database, Scale, TrendingUp, FlaskConical, Sliders, Cpu } from 'lucide-react';
import { useGameStore } from './store/gameStore';
import { CustomBlockNode } from './components/CustomBlockNode';
import { LiveChatDrawer } from './components/LiveChatDrawer';
import { ChunkInspectorModal } from './components/ChunkInspectorModal';
import { IndexBenchmarkModal } from './components/IndexBenchmarkModal';
import { ScaleBenchmarkModal } from './components/ScaleBenchmarkModal';
import { BatchEvaluationModal } from './components/BatchEvaluationModal';
import { MemoryTunerModal } from './components/MemoryTunerModal';
import { MaintenanceLiveBanner } from './components/MaintenanceLiveBanner';
import { SystemMetricsWidget } from './components/SystemMetricsWidget';
import { BufferSaturationAlert } from './components/BufferSaturationAlert';

export default function App() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useGameStore();
  const [chunkInspectorOpen, setChunkInspectorOpen] = useState(false);
  const [inspectorDocId, setInspectorDocId] = useState('');
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [isBatchEvalOpen, setIsBatchEvalOpen] = useState(false);
  const [isTunerOpen, setIsTunerOpen] = useState(false);

  const nodeTypes = useMemo(() => ({
    docLoader: CustomBlockNode,
    embeddingGen: CustomBlockNode,
    pgVectorStore: CustomBlockNode,
    promptTemplate: CustomBlockNode,
    llmNode: CustomBlockNode,
  }), []);

  useEffect(() => {
    const handler = (e: any) => {
      setInspectorDocId(e.detail?.docId || '');
      setChunkInspectorOpen(true);
    };
    window.addEventListener('open-chunk-inspector', handler);
    return () => window.removeEventListener('open-chunk-inspector', handler);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-mono">
      <BufferSaturationAlert />
      <MaintenanceLiveBanner />
      <SystemMetricsWidget />

      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold text-sm tracking-wide">AI AGENT ACADEMY</span>
          <span className="text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded">Enterprise RAG Studio</span>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={() => { setInspectorDocId(''); setChunkInspectorOpen(true); }} className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-md text-xs transition">
            <Database className="w-3.5 h-3.5 text-purple-400" /><span>Ver Chunks</span>
          </button>
          <button onClick={() => setIsBenchmarkOpen(true)} className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-md text-xs transition">
            <Scale className="w-3.5 h-3.5 text-indigo-400" /><span>Benchmark HNSW</span>
          </button>
          <button onClick={() => setIsScaleOpen(true)} className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-md text-xs transition">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /><span>Escala 100k</span>
          </button>
          <button onClick={() => setIsTunerOpen(true)} className="flex items-center space-x-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 px-3 py-1.5 rounded-md text-xs transition">
            <Sliders className="w-3.5 h-3.5 text-amber-400" /><span>Memory Tuner</span>
          </button>
          <button onClick={() => setIsBatchEvalOpen(true)} className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-md text-xs transition shadow">
            <FlaskConical className="w-3.5 h-3.5" /><span>Batch RAGAS</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 h-full relative">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
            <Background color="#1e293b" gap={20} />
            <Controls className="bg-slate-900 border-slate-700 fill-slate-200" />
            <MiniMap className="bg-slate-900 border border-slate-800" nodeColor="#6366f1" />
          </ReactFlow>
        </div>
        <LiveChatDrawer />
      </div>

      {chunkInspectorOpen && <ChunkInspectorModal initialDocId={inspectorDocId} onClose={() => setChunkInspectorOpen(false)} />}
      {isBenchmarkOpen && <IndexBenchmarkModal onClose={() => setIsBenchmarkOpen(false)} />}
      {isScaleOpen && <ScaleBenchmarkModal onClose={() => setIsScaleOpen(false)} />}
      {isBatchEvalOpen && <BatchEvaluationModal onClose={() => setIsBatchEvalOpen(false)} />}
      {isTunerOpen && <MemoryTunerModal onClose={() => setIsTunerOpen(false)} />}
    </div>
  );
}
