import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter
from server.llm_client import call_llm, CURRENT_CONFIG
from server.embedding_client import generate_embedding
from server.mcp_bridge import invoke_mcp_tool
from server.ragas_evaluator import (
    evaluate_faithfulness,
    evaluate_answer_relevance,
    evaluate_context_precision,
    normalize_score_status,
)

chat_router = APIRouter(prefix="/api/chat", tags=["Live Pipeline Runner"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class ChatRunRequest(BaseModel):
    query: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

@chat_router.post("/run")
async def execute_live_pipeline(req: ChatRunRequest):
    t0 = time.perf_counter()
    query = req.query
    type_map = {n["type"]: n for n in req.nodes}
    mcp_nodes = [n for n in req.nodes if n["type"] == "mcpClient"]

    provider = CURRENT_CONFIG.get("provider", "mock")
    llm_node = type_map.get("llmNode", {})
    prompt_node = type_map.get("promptTemplate", {})
    vector_node = type_map.get("pgVectorStore", {})
    emb_node = type_map.get("embeddingGen", {})

    emb_data = emb_node.get("data", {})
    emb_provider = emb_data.get("provider", provider)
    emb_model = emb_data.get("model", "text-embedding-3-small")

    temp = float(llm_node.get("data", {}).get("temperature", 0.2))
    max_tokens = int(llm_node.get("data", {}).get("maxTokens", 512))
    active_model_name = llm_node.get("data", {}).get("model", "gpt-4o-mini")
    template_raw = prompt_node.get("data", {}).get("template", "Contexto:\n{context}\n\nPregunta: {query}")

    retrieved_chunks: List[str] = []
    mcp_traces: List[str] = []

    # 1. Ejecutar herramientas de nodos MCP Client conectados al grafo
    for m_node in mcp_nodes:
        m_data = m_node.get("data", {})
        server_url = m_data.get("serverUrl", "builtin://omnicorp-erp")
        selected_tool = m_data.get("selectedTool", "")
        if selected_tool:
            tool_out = await invoke_mcp_tool(server_url, selected_tool, {"query": query})
            mcp_traces.append(tool_out)
            retrieved_chunks.append(tool_out)

    # 2. Recuperación semántica en pgvector si el nodo está en el grafo
    if "pgVectorStore" in type_map:
        top_k = int(vector_node.get("data", {}).get("topK", 3))
        try:
            query_vector = await generate_embedding(text=query, provider=emb_provider, model=emb_model)
            vector_literal = f"[{','.join(str(x) for x in query_vector)}]"

            conn = psycopg2.connect(DATABASE_URL)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT content, (embedding <=> %s::vector) AS dist
                    FROM corporate_documents
                    WHERE tenant_id = 'omnicorp'
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s;
                    """,
                    (vector_literal, vector_literal, top_k),
                )
                rows = cur.fetchall()
            conn.close()
            for r in rows:
                if float(r["dist"]) <= 0.35:
                    retrieved_chunks.append(r["content"])
        except Exception as e:
            print(f"[!] Error pgvector: {e}")

    # 3. Ensamblado de contexto e inferencia LLM
    context_str = "\n".join(retrieved_chunks) if retrieved_chunks else "Sin evidencia documental."
    assembled_prompt = template_raw.replace("{context}", context_str).replace("{query}", query)

    system_prompt = (
        "Eres un agente corporativo estricto de OmniCorp. "
        "Utiliza los resultados de herramientas MCP y el contexto documental. "
        "Si la respuesta no figura en el contexto, indica: 'No dispongo de información oficial sobre esa política.'"
    )

    if provider == "mock":
        if mcp_traces and len(retrieved_chunks) == len(mcp_traces):
            generated_response = f"Resultado obtenido vía herramienta MCP: {mcp_traces[0]}"
        elif retrieved_chunks:
            generated_response = f"Según la documentación y herramientas conectadas: {retrieved_chunks[0]}"
        else:
            generated_response = "No dispongo de información oficial sobre esa política en la base de conocimiento."
    else:
        generated_response = await call_llm(
            prompt=assembled_prompt,
            system_prompt=system_prompt,
            temperature=temp,
            max_tokens=max_tokens,
        )

    latency = int((time.perf_counter() - t0) * 1000)

    # 4. Evaluación RAGAS
    f_score, _, f_exp = await evaluate_faithfulness(generated_response, retrieved_chunks, provider)
    r_score, r_exp = await evaluate_answer_relevance(query, generated_response, provider)
    cp_score, cp_exp = evaluate_context_precision(query, retrieved_chunks)

    ragas_telemetry = {
        "faithfulness": {"score": f_score, "status": normalize_score_status(f_score), "exp": f_exp},
        "answer_relevance": {"score": r_score, "status": normalize_score_status(r_score), "exp": r_exp},
        "context_precision": {"score": cp_score, "status": normalize_score_status(cp_score), "exp": cp_exp},
        "composite": round((f_score * 0.45) + (r_score * 0.30) + (cp_score * 0.25), 2),
    }

    return {
        "response": generated_response,
        "context_chunks": retrieved_chunks,
        "mcp_traces": mcp_traces,
        "latency_ms": latency,
        "applied_temperature": temp,
        "provider": provider,
        "model": active_model_name,
        "ragas": ragas_telemetry,
    }
