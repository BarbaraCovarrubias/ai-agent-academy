import { create } from 'zustand';
import {
  Node, Edge, OnNodesChange, OnEdgesChange, OnConnect,
  applyNodeChanges, applyEdgeChanges, addEdge,
} from 'reactflow';

interface GameState {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  updateNodeData: (id: string, newData: Record<string, any>) => void;
  addNode: (node: Node) => void;
  removeNode: (id: string) => void;
  clearCanvas: () => void;
  resetDefaultPipeline: () => void;
}

const initialNodes: Node[] = [
  { id: 'node-loader', type: 'docLoader', position: { x: 40, y: 60 }, data: { label: 'Document Loader', source: 'politicas_omnicorp.pdf' } },
  { id: 'node-embed', type: 'embeddingGen', position: { x: 40, y: 240 }, data: { label: 'Embedding Generator', provider: 'mock', model: 'text-embedding-3-small' } },
  { id: 'node-vector', type: 'pgVectorStore', position: { x: 340, y: 150 }, data: { label: 'pgvector HNSW Store', indexType: 'HNSW', topK: 3 } },
  { id: 'node-prompt', type: 'promptTemplate', position: { x: 640, y: 60 }, data: { label: 'Prompt Template', template: 'Contexto oficial:\n{context}\n\nConsulta del empleado: {query}' } },
  { id: 'node-llm', type: 'llmNode', position: { x: 640, y: 260 }, data: { label: 'LLM Engine', provider: 'mock', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 512 } },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'node-loader', target: 'node-vector', animated: true },
  { id: 'e2', source: 'node-embed', target: 'node-vector', animated: true },
  { id: 'e3', source: 'node-vector', target: 'node-prompt', animated: true },
  { id: 'e4', source: 'node-prompt', target: 'node-llm', animated: true },
];

export const useGameStore = create<GameState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (connection) => set({ edges: addEdge({ ...connection, animated: true }, get().edges) }),
  updateNodeData: (id, newData) =>
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      ),
    }),
  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  removeNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    }),
  clearCanvas: () => set({ nodes: [], edges: [] }),
  resetDefaultPipeline: () => set({ nodes: initialNodes, edges: initialEdges }),
}));
