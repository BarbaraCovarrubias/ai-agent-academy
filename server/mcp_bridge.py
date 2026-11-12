import httpx
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

mcp_router = APIRouter(prefix="/api/mcp", tags=["MCP Client Bridge"])

# Herramientas integradas para pruebas instantáneas sin servidor externo
BUILTIN_MCP_SERVERS: Dict[str, List[Dict[str, Any]]] = {
    "builtin://omnicorp-erp": [
        {
            "name": "get_employee_balance",
            "description": "Consulta saldo disponible de reintegros y días de vacaciones de un empleado.",
            "inputSchema": {"type": "object", "properties": {"employee_id": {"type": "string"}}}
        },
        {
            "name": "check_ticket_status",
            "description": "Verifica el estado de un ticket de soporte IT o infraestructura.",
            "inputSchema": {"type": "object", "properties": {"ticket_id": {"type": "string"}}}
        }
    ],
    "builtin://devops-telemetry": [
        {
            "name": "get_cluster_health",
            "description": "Obtiene estado de nodos EKS, latencia de API Gateway y colas Kafka.",
            "inputSchema": {"type": "object", "properties": {}}
        }
    ]
}

class MCPDiscoverRequest(BaseModel):
    server_url: str

class MCPExecuteRequest(BaseModel):
    server_url: str
    tool_name: str
    arguments: Dict[str, Any] = {}

def _execute_builtin_tool(server_url: str, tool_name: str, arguments: Dict[str, Any]) -> str:
    if tool_name == "get_employee_balance":
        emp = arguments.get("employee_id", "EMP-2026")
        return f"[MCP ERP] Empleado {emp}: Saldo conectividad disponible $45.000 ARS | Vacaciones acumuladas: 14 días hábiles."
    if tool_name == "check_ticket_status":
        tk = arguments.get("ticket_id", "INC-904")
        return f"[MCP IT] Ticket {tk}: RESUELTO. Túnel Zero Trust habilitado en producción."
    if tool_name == "get_cluster_health":
        return "[MCP DevOps] Cluster EKS prod-sa-east-1: HEALTHY (99.98% uptime, Kafka lag: 0 msgs)."
    return f"[MCP {server_url}] Tool '{tool_name}' ejecutada con argumentos {arguments}."

async def discover_mcp_tools(server_url: str) -> List[Dict[str, Any]]:
    if server_url in BUILTIN_MCP_SERVERS:
        return BUILTIN_MCP_SERVERS[server_url]

    # Protocolo JSON-RPC 2.0 estándar de MCP (tools/list) sobre HTTP
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                server_url,
                json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
                headers={"Content-Type": "application/json"},
            )
            res.raise_for_status()
            data = res.json()
            return data.get("result", {}).get("tools", [])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar al servidor MCP ({server_url}): {str(e)}")

async def invoke_mcp_tool(server_url: str, tool_name: str, arguments: Dict[str, Any]) -> str:
    if server_url in BUILTIN_MCP_SERVERS:
        return _execute_builtin_tool(server_url, tool_name, arguments)

    # Protocolo JSON-RPC 2.0 estándar de MCP (tools/call)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                server_url,
                json={
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/call",
                    "params": {"name": tool_name, "arguments": arguments},
                },
                headers={"Content-Type": "application/json"},
            )
            res.raise_for_status()
            data = res.json()
            content_list = data.get("result", {}).get("content", [])
            if content_list and isinstance(content_list, list):
                return "\n".join(c.get("text", str(c)) for c in content_list)
            return str(data.get("result", "Sin salida"))
    except Exception as e:
        return f"[Error MCP Tool {tool_name}]: {str(e)}"

@mcp_router.post("/discover")
async def api_discover_tools(req: MCPDiscoverRequest):
    tools = await discover_mcp_tools(req.server_url)
    return {"server_url": req.server_url, "tools": tools, "count": len(tools)}

@mcp_router.post("/call")
async def api_call_tool(req: MCPExecuteRequest):
    output = await invoke_mcp_tool(req.server_url, req.tool_name, req.arguments)
    return {"tool_name": req.tool_name, "output": output}
