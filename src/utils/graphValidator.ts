import { Node, Edge, Connection } from 'reactflow';

export interface GraphDiagnostic {
  id: string;
  severity: 'error' | 'warning';
  nodeId?: string;
  message: string;
  fixHint: string;
}

// Matriz de conexiones permitidas (origen -> destinos válidos)
const ALLOWED_CONNECTIONS: Record<string, string[]> = {
  docLoader: ['pgVectorStore'],
  embeddingGen: ['pgVectorStore'],
  pgVectorStore: ['promptTemplate', 'llmNode'],
  mcpClient: ['promptTemplate', 'llmNode'],
  promptTemplate: ['llmNode'],
  llmNode: [], // Nodo terminal
};

export function checkValidConnection(connection: Connection, nodes: Node[], edges: Edge[]): boolean {
  if (!connection.source || !connection.target) return false;
  if (connection.source === connection.target) return false; // Evita auto-loops

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  // Evitar aristas duplicadas
  const alreadyExists = edges.some(
    (e) => e.source === connection.source && e.target === connection.target
  );
  if (alreadyExists) return false;

  const allowedTargets = ALLOWED_CONNECTIONS[sourceNode.type || ''] || [];
  return allowedTargets.includes(targetNode.type || '');
}

export function validateGraphTopology(nodes: Node[], edges: Edge[]): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [];

  if (nodes.length === 0) {
    diagnostics.push({
      id: 'empty-canvas',
      severity: 'error',
      message: 'El canvas está vacío.',
      fixHint: 'Arrastrá al menos un Prompt Template y un LLM Engine desde la barra izquierda.',
    });
    return diagnostics;
  }

  // 1. Verificar presencia de nodo terminal LLM
  const llmNodes = nodes.filter((n) => n.type === 'llmNode');
  if (llmNodes.length === 0) {
    diagnostics.push({
      id: 'missing-llm',
      severity: 'error',
      message: 'Falta un nodo terminal LLM Engine.',
      fixHint: 'Arrastrá el bloque "LLM Engine" para sintetizar las respuestas.',
    });
  }

  // 2. Detectar nodos huérfanos (sin conexiones entrantes ni salientes)
  nodes.forEach((node) => {
    const incoming = edges.filter((e) => e.target === node.id);
    const outgoing = edges.filter((e) => e.source === node.id);

    if (incoming.length === 0 && outgoing.length === 0) {
      diagnostics.push({
        id: `orphan-${node.id}`,
        severity: 'warning',
        nodeId: node.id,
        message: `El nodo "${node.data?.label}" está desconectado (huérfano).`,
        fixHint: 'Conectá su salida hacia el siguiente bloque o eliminalo para que participe en la ejecución.',
      });
    } else if (node.type !== 'llmNode' && outgoing.length === 0) {
      diagnostics.push({
        id: `deadend-${node.id}`,
        severity: 'error',
        nodeId: node.id,
        message: `La salida de "${node.data?.label}" no llega a ningún destino.`,
        fixHint: 'Arrastrá un cable desde su punto derecho hacia Prompt Template o LLM Engine.',
      });
    }

    // 3. Validaciones internas por tipo de nodo
    if (node.type === 'pgVectorStore') {
      const hasDoc = incoming.some((e) => nodes.find((n) => n.id === e.source)?.type === 'docLoader');
      const hasEmb = incoming.some((e) => nodes.find((n) => n.id === e.source)?.type === 'embeddingGen');
      if (!hasDoc || !hasEmb) {
        diagnostics.push({
          id: `vector-inputs-${node.id}`,
          severity: 'warning',
          nodeId: node.id,
          message: 'pgvector HNSW Store requiere Document Loader + Embedding Generator conectados.',
          fixHint: 'Cableá tanto Document Loader como Embedding Gen hacia la entrada de pgvector.',
        });
      }
    }

    if (node.type === 'mcpClient' && !node.data?.selectedTool) {
      diagnostics.push({
        id: `mcp-notool-${node.id}`,
        severity: 'warning',
        nodeId: node.id,
        message: `El conector "${node.data?.label}" no tiene una tool activa.`,
        fixHint: 'Hacé clic en "Descubrir Tools (tools/list)" dentro del nodo MCP.',
      });
    }

    if (node.type === 'promptTemplate') {
      const tpl: string = node.data?.template || '';
      if (!tpl.includes('{query}')) {
        diagnostics.push({
          id: `prompt-noquery-${node.id}`,
          severity: 'error',
          nodeId: node.id,
          message: 'El Prompt Template no contiene la variable {query}.',
          fixHint: 'Incluí {query} en el texto del prompt para que el LLM reciba la pregunta del usuario.',
        });
      }
    }
  });

  return diagnostics;
}
