import EnterpriseStudioPanel from "./components/EnterpriseStudioPanel";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, ReactFlowInstance, Connection } from 'reactflow';
import { Database, Scale, TrendingUp, FlaskConical, Sliders, Cpu } from 'lucide-react';
import { useGameStore } from './store/gameStore';
import { CustomBlockNode } from './components/CustomBlockNode';
import { NodePaletteSidebar } from './components/NodePaletteSidebar';
import { GraphHealthBadge } from './components/GraphHealthBadge';
import { LiveChatDrawer } from './components/LiveChatDrawer';
import { ChunkInspectorModal } from './components/ChunkInspectorModal';
import { IndexBenchmarkModal } from './components/IndexBenchmarkModal';
import { ScaleBenchmarkModal } from './components/ScaleBenchmarkModal';
import { BatchEvaluationModal } from './components/BatchEvaluationModal';
import { MemoryTunerModal } from './components/MemoryTunerModal';
import { MaintenanceLiveBanner } from './components/MaintenanceLiveBanner';
import { SystemMetricsWidget } from './components/SystemMetricsWidget';
import { BufferSaturationAlert } from './components/BufferSaturationAlert';
import { checkValidConnection, validateGraphTopology } from './utils/graphValidator';

function StudioCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useGameStore();
  const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [invalidToast, setInvalidToast] = useState<string | null>(null);

  const [chunkInspectorOpen, setChunkInspectorOpen] = useState(false);
  const [inspectorDocId, setInspectorDocId] = useState('');
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);
  const [isBatchEvalOpen, setIsBatchEvalOpen] = useState(false);
  const [isTunerOpen, setIsTunerOpen] = useState(false);

  const diagnostics = useMemo(() => validateGraphTopology(nodes, edges), [nodes, edges]);

  const decoratedNodes = useMemo(() => {
    return nodes.map((n) => {
      const nodeDiag = diagnostics.find((d) => d.nodeId === n.id);
      return { ...n, data: { ...n.data, diagnostic: nodeDiag } };
    });
  }, [nodes, diagnostics]);

  const nodeTypes = useMemo(() => ({
    docLoader: CustomBlockNode,
    embeddingGen: CustomBlockNode,
    pgVectorStore: CustomBlockNode,
    mcpClient: CustomBlockNode,
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

  const isValidConnection = useCallback(
    (conn: Connection) => checkValidConnection(conn, nodes, edges),
    [nodes, edges]
  );

  const handleConnect = useCallback(
    (conn: Connection) => {
      if (!checkValidConnection(conn, nodes, edges)) {
        setInvalidToast('Conexión inválida: revisá la dirección lógica del flujo RAG/MCP.');
        setTimeout(() => setInvalidToast(null), 3500);
        return;
      }
      onConnect(conn);
    },
    [nodes, edges, onConnect]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('application/reactflow');
      if (!raw || !rfInstance) return;
      const parsed = JSON.parse(raw);
      const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode({
        id: `${parsed.type}-${Date.now()}`,
        type: parsed.type,
        position,
        data: parsed.data,
      });
    },
    [rfInstance, addNode]
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-mono">
      <BufferSaturationAlert />
      <MaintenanceLiveBanner />
      <SystemMetricsWidget />

      {invalidToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-950 border border-rose-500 text-rose-200 px-4 py-2 rounded-xl shadow-2xl text-xs font-bold">
          🚫 {invalidToast}
        </div>
      )}

      <header className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2.5">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <span className="font-extrabold text-sm tracking-wide">AI AGENT ACADEMY</span>
          <span className="text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded">Enterprise RAG & MCP Studio</span>
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
        <NodePaletteSidebar />

        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <GraphHealthBadge diagnostics={diagnostics} />

          <ReactFlow
            nodes={decoratedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            isValidConnection={isValidConnection}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            fitView
          >
            <Background color="#1e293b" gap={20} />
            <Controls className="bg-slate-900 border-slate-700 fill-slate-200" />
            <MiniMap
              style={{ backgroundColor: '#0f172a' }}
              maskColor="rgba(2, 6, 23, 0.75)"
              nodeColor="#6366f1"
              className="border border-slate-800 rounded-lg overflow-hidden"
            />
          </ReactFlow>
        <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20, width: 470, maxWidth: "92vw" }}>
          <EnterpriseStudioPanel
            nodes={nodes}
            edges={edges}
            sandboxMode={sandboxMode}
            setSandboxMode={setSandboxMode}
            onLoadWorkflow={(n: any, e: any) => { setNodes(n); setEdges(e); }}
          />
        </div>
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

export default function App() {
  return (
    <ReactFlowProvider>
      <StudioCanvas />
    </ReactFlowProvider>
  );
}
