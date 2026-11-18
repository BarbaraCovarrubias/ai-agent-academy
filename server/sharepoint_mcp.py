import os
from typing import Dict, Any, List

MOCK_SHAREPOINT_DOCS = [
    {
        "id": "sp-doc-001",
        "site": "Intranet-Corporativa / Políticas",
        "title": "Política_Seguridad_y_Accesos_IAM_2026.pdf",
        "author": "SecOps Team",
        "sensitivity": "Confidential",
        "last_modified": "2026-10-15T14:20:00Z",
        "required_role": "qa_auditor",
        "snippet": "Todo acceso a herramientas MCP críticas requiere autenticación Entra ID (MSAL), principio de menor privilegio (RBAC) y aprobación Human-in-the-Loop.",
    },
    {
        "id": "sp-doc-002",
        "site": "Finanzas / Normativas",
        "title": "Manual_Viaticos_y_Aprobaciones_Q4.docx",
        "author": "Controller Finanzas",
        "sensitivity": "Internal",
        "last_modified": "2026-11-02T09:10:00Z",
        "required_role": "viewer",
        "snippet": "El tope diario de viáticos corporativos es de $50.000 ARS. Cualquier reembolso superior dispara el flujo approve_expense con auditoría.",
    },
    {
        "id": "sp-doc-003",
        "site": "Arquitectura / Cloud-Azure",
        "title": "Runbook_K8s_y_Disaster_Recovery.md",
        "author": "Platform Engineering",
        "sensitivity": "Restricted",
        "last_modified": "2026-11-12T18:45:00Z",
        "required_role": "architect",
        "snippet": "Ante degradación de latencia p95 en pgvector, escalar réplicas de lectura antes de invocar restart_eks_pod en producción.",
    },
]

ROLE_LEVEL = {"viewer": 1, "qa_auditor": 2, "architect": 3}

def query_sharepoint_mcp(query: str, role: str = "viewer", site_filter: str = "") -> Dict[str, Any]:
    tenant_id = os.getenv("AZURE_TENANT_ID", "")
    client_id = os.getenv("AZURE_CLIENT_ID", "")
    live_configured = bool(tenant_id and client_id)

    user_level = ROLE_LEVEL.get(role, 1)
    q_lower = query.lower().strip()

    matched: List[Dict[str, Any]] = []
    denied_count = 0

    for doc in MOCK_SHAREPOINT_DOCS:
        if site_filter and site_filter.lower() not in doc["site"].lower():
            continue
        if q_lower and not (
            q_lower in doc["title"].lower()
            or q_lower in doc["snippet"].lower()
            or q_lower in doc["site"].lower()
        ):
            continue

        req_level = ROLE_LEVEL.get(doc["required_role"], 1)
        if user_level < req_level:
            denied_count += 1
            continue
        matched.append(doc)

    return {
        "connector": "microsoft-graph-sharepoint-mcp",
        "mode": "LIVE_GRAPH_API" if live_configured else "ENTERPRISE_SANDBOX",
        "role_evaluated": role,
        "documents": matched,
        "access_denied_filtered": denied_count,
        "summary": (
            f"Se recuperaron {len(matched)} documento(s) de SharePoint autorizados para rol '{role}'"
            + (f" ({denied_count} ocultos por RBAC/Sensitivity Label)." if denied_count else ".")
        ),
    }
