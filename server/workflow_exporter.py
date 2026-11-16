import os, json, psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.getenv("DATABASE_URL", "postgresql://academy_admin:academy_pass@localhost:5432/agent_academy")

def save_workflow_db(name: str, description: str, nodes: list, edges: list):
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COALESCE(MAX(version), 0) + 1 AS next_v FROM saved_workflows WHERE name = %s;", (name,))
            next_v = cur.fetchone()["next_v"]
            cur.execute("""
                INSERT INTO saved_workflows (name, description, version, nodes, edges)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                RETURNING id, name, version, created_at;
            """, (name, description, next_v, json.dumps(nodes), json.dumps(edges)))
            res = dict(cur.fetchone())
            res["created_at"] = res["created_at"].isoformat()
        conn.commit()
        return res
    finally:
        conn.close()

def list_workflows_db():
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM saved_workflows ORDER BY created_at DESC LIMIT 25;")
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r["created_at"] = r["created_at"].isoformat()
            return rows
    finally:
        conn.close()

def generate_langgraph_code(nodes: list, edges: list) -> str:
    node_map = {n["type"]: n.get("data", {}) for n in nodes}
    has_rag = "pgVectorStore" in node_map or "hybridRetriever" in node_map
    has_mcp = "mcpClient" in node_map
    llm_cfg = node_map.get("llmNode", {})
    mcp_cfg = node_map.get("mcpClient", {})

    return f"""# Generado automaticamente por AI Agent Academy Studio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import psycopg2

class AgentState(TypedDict):
    query: str
    route: str
    context_chunks: List[str]
    mcp_output: str
    answer: str
    faithfulness_score: float
    retries: int

def router_node(state: AgentState) -> AgentState:
    q = state["query"].lower()
    state["route"] = "hybrid_parallel" if any(k in q for k in ["saldo", "pod", "deploy"]) else "rag_only"
    return state

def hybrid_rag_node(state: AgentState) -> AgentState:
    conn = psycopg2.connect("postgresql://academy_admin:academy_pass@localhost:5432/agent_academy")
    with conn.cursor() as cur:
        cur.execute("SELECT content FROM corporate_documents LIMIT {node_map.get("pgVectorStore", {}).get("topK", 3)};")
        state["context_chunks"] = [r[0] for r in cur.fetchall()]
    conn.close()
    return state

def mcp_tool_node(state: AgentState) -> AgentState:
    state["mcp_output"] = "Resultado MCP ({mcp_cfg.get("serverUrl", "builtin://omnicorp-erp")}): {mcp_cfg.get("selectedTool", "get_employee_benefits")}"
    return state

def llm_generator_node(state: AgentState) -> AgentState:
    # Provider: {llm_cfg.get("provider", "openai")} | Temp: {llm_cfg.get("temperature", 0.1)}
    state["answer"] = f"Respuesta generada con {{len(state.get('context_chunks', []))}} chunks."
    state["faithfulness_score"] = 0.98
    return state

workflow = StateGraph(AgentState)
workflow.add_node("router", router_node)
{"workflow.add_node('hybrid_rag', hybrid_rag_node)" if has_rag else ""}
{"workflow.add_node('mcp_client', mcp_tool_node)" if has_mcp else ""}
workflow.add_node("llm_engine", llm_generator_node)
workflow.set_entry_point("router")
workflow.add_edge("llm_engine", END)
app = workflow.compile()
"""
