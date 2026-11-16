from server.hybrid_reranker import compute_rrf
from server.mcp_governance import check_mcp_policy
from server.multi_agent_router import classify_intent, rewrite_query_for_reflection
from server.workflow_exporter import generate_langgraph_code

def test_hybrid_rrf_and_reranker():
    vec = {
        1: {"id": 1, "content": "Politica de vacaciones generales", "vec_rank": 1},
        2: {"id": 2, "content": "Codigo interno ERR-504 timeout gateway", "vec_rank": 3},
    }
    fts = {
        2: {"id": 2, "content": "Codigo interno ERR-504 timeout gateway", "fts_rank": 1},
    }
    res = compute_rrf(vec, fts, "codigo ERR-504", top_k=2, use_reranker=True)
    assert res[0]["id"] == 2
    assert res[0]["final_score"] > res[1]["final_score"]

def test_mcp_governance_rbac_and_hitl():
    assert check_mcp_policy("get_employee_benefits", "viewer")["allowed"] is False
    hitl = check_mcp_policy("restart_eks_pod", "architect", hitl_confirmed=False)
    assert hitl["allowed"] is False and hitl["requires_hitl"] is True
    ok = check_mcp_policy("restart_eks_pod", "architect", hitl_confirmed=True)
    assert ok["allowed"] is True

def test_multi_agent_router_and_reflection():
    r1 = classify_intent("Cual es mi saldo de vacaciones y la politica de viaticos?")
    assert r1["route"] == "hybrid_parallel"
    rewritten = rewrite_query_for_reflection("tope viaticos", attempt=1)
    assert "reintento #1" in rewritten

def test_langgraph_exporter():
    nodes = [{"type": "pgVectorStore", "data": {"topK": 4}}, {"type": "mcpClient", "data": {}}, {"type": "llmNode", "data": {"provider": "ollama"}}]
    code = generate_langgraph_code(nodes, [])
    assert "StateGraph(AgentState)" in code
    assert "LIMIT 4" in code
