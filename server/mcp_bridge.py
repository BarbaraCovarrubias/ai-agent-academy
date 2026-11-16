import httpx
from typing import Dict, Any

BUILTIN_SERVERS = {
    "builtin://omnicorp-erp": [
        {"name": "get_employee_benefits", "description": "Consulta saldo de vacaciones, reintegros y beneficios vigentes."},
        {"name": "check_expense_policy", "description": "Valida topes de viaticos y aprobaciones por categoria."}
    ],
    "builtin://devops-telemetry": [
        {"name": "get_eks_pod_health", "description": "Obtiene estado de pods, restarts y latencia p99 en Kubernetes."},
        {"name": "inspect_kafka_lag", "description": "Mide consumer lag por topico en clusters de eventos."}
    ]
}

async def _mcp_http_handshake(client: httpx.AsyncClient, server_url: str) -> Dict[str, str]:
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    init_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "clientInfo": {"name": "ai-agent-academy-client", "version": "1.1.0"}
        }
    }
    res = await client.post(server_url, json=init_payload, headers=headers)
    res.raise_for_status()
    session_id = res.headers.get("Mcp-Session-Id")
    if session_id:
        headers["Mcp-Session-Id"] = session_id

    # Notificacion obligatoria segun especificacion MCP tras recibir InitializeResult
    notif_payload = {"jsonrpc": "2.0", "method": "notifications/initialized"}
    await client.post(server_url, json=notif_payload, headers=headers)
    return headers

async def discover_mcp_tools(server_url: str) -> Dict[str, Any]:
    if server_url in BUILTIN_SERVERS:
        return {"status": "connected", "protocol": "MCP JSON-RPC 2.0 (Builtin)", "tools": BUILTIN_SERVERS[server_url]}

    async with httpx.AsyncClient(timeout=8.0) as client:
        headers = await _mcp_http_handshake(client, server_url)
        list_payload = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        res = await client.post(server_url, json=list_payload, headers=headers)
        res.raise_for_status()
        data = res.json()
        tools = data.get("result", {}).get("tools", [])
        return {"status": "connected", "protocol": "MCP JSON-RPC 2.0 (Initialized)", "tools": tools}

async def invoke_mcp_tool(server_url: str, tool_name: str, query: str) -> Dict[str, Any]:
    if server_url in BUILTIN_SERVERS:
        if tool_name == "get_employee_benefits":
            return {"tool": tool_name, "result": "Saldo disponible: 14 dias de vacaciones + $85.000 ARS en reintegros de conectividad."}
        if tool_name == "get_eks_pod_health":
            return {"tool": tool_name, "result": "Cluster prod-eks: 12/12 pods Running | Latencia p99: 42ms | 0 OOMKilled."}
        return {"tool": tool_name, "result": f"Ejecucion simulada exitosa para {tool_name} con query: {query}"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        headers = await _mcp_http_handshake(client, server_url)
        call_payload = {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": {"query": query}}
        }
        res = await client.post(server_url, json=call_payload, headers=headers)
        res.raise_for_status()
        return {"tool": tool_name, "result": res.json().get("result", {})}


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

mcp_router = APIRouter(prefix="/api/mcp", tags=["MCP"])

class DiscoverRequest(BaseModel):
    server_url: str

class CallToolRequest(BaseModel):
    server_url: str
    tool_name: str
    query: str = ""

@mcp_router.post("/discover")
async def api_discover_tools(req: DiscoverRequest):
    try:
        return await discover_mcp_tools(req.server_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error MCP handshake/discover: {str(e)}")

@mcp_router.post("/call")
async def api_call_tool(req: CallToolRequest):
    try:
        return await invoke_mcp_tool(req.server_url, req.tool_name, req.query)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error MCP tool execution: {str(e)}")
