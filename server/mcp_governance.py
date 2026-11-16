import os, json, psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.getenv("DATABASE_URL", "postgresql://academy_admin:academy_pass@localhost:5432/agent_academy")
SENSITIVE_TOOLS = {"approve_expense", "restart_eks_pod", "scale_deployment", "update_salary"}

def check_mcp_policy(tool_name: str, user_role: str = "architect", hitl_confirmed: bool = False):
    if user_role == "viewer":
        return {"allowed": False, "requires_hitl": False, "reason": "RBAC: El rol viewer no tiene permisos de ejecucion MCP."}
    if tool_name in SENSITIVE_TOOLS and not hitl_confirmed:
        return {
            "allowed": False,
            "requires_hitl": True,
            "reason": f"HITL Requerido: La tool critica '{tool_name}' requiere aprobacion humana explicita."
        }
    return {"allowed": True, "requires_hitl": False, "reason": "OK"}

def log_mcp_execution(user_role: str, server_url: str, tool_name: str, input_payload: dict, output_payload: dict, status: str, latency_ms: float):
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO mcp_audit_logs (user_role, server_url, tool_name, input_payload, output_payload, approval_status, latency_ms)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s, %s);
            """, (user_role, server_url, tool_name, json.dumps(input_payload), json.dumps(output_payload), status, latency_ms))
        conn.commit()
    finally:
        conn.close()

def get_mcp_audit_logs(limit: int = 30):
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT * FROM mcp_audit_logs ORDER BY timestamp DESC LIMIT %s;", (limit,))
            rows = [dict(r) for r in cur.fetchall()]
            for r in rows:
                r["timestamp"] = r["timestamp"].isoformat()
            return rows
    finally:
        conn.close()
