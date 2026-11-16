import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function EnterpriseStudioPanel({ nodes = [], edges = [], onLoadWorkflow, sandboxMode, setSandboxMode }) {
  const [activeTab, setActiveTab] = useState("governance");
  const [userRole, setUserRole] = useState("architect");
  const [testTool, setTestTool] = useState("restart_eks_pod");
  const [govStatus, setGovStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [wfName, setWfName] = useState("Pipeline Enterprise RAG+MCP");
  const [exportedCode, setExportedCode] = useState("");
  const [routerQuery, setRouterQuery] = useState("Consultar saldo de vacaciones y politica de viaticos");
  const [routerResult, setRouterResult] = useState(null);

  const loadLogs = async () => {
    if (sandboxMode) {
      setAuditLogs([{ id: 1, timestamp: new Date().toISOString(), user_role: userRole, tool_name: "get_employee_benefits", approval_status: "AUTO_APPROVED", latency_ms: 18.4 }]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/v2/mcp/audit-logs`);
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (e) { console.error(e); }
  };

  const loadWorkflows = async () => {
    if (sandboxMode) return;
    try {
      const res = await fetch(`${API_BASE}/api/v2/workflows/list`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeTab === "governance") loadLogs();
    if (activeTab === "workflows") loadWorkflows();
  }, [activeTab, sandboxMode]);

  const checkPolicy = async (hitlConfirmed = false) => {
    if (sandboxMode) {
      const isCrit = ["restart_eks_pod", "approve_expense"].includes(testTool);
      if (userRole === "viewer") return setGovStatus({ allowed: false, reason: "RBAC (Sandbox): El rol viewer no tiene permisos." });
      if (isCrit && !hitlConfirmed) return setGovStatus({ allowed: false, requires_hitl: true, reason: `HITL Requerido para ${testTool}` });
      return setGovStatus({ allowed: true, reason: "Ejecucion aprobada en modo Sandbox." });
    }
    const res = await fetch(`${API_BASE}/api/v2/mcp/governance/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: testTool, user_role: userRole, hitl_confirmed: hitlConfirmed })
    });
    setGovStatus(await res.json());
  };

  const handleSaveWorkflow = async () => {
    if (sandboxMode) return alert("Guardado simulado en Modo Sandbox.");
    await fetch(`${API_BASE}/api/v2/workflows/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wfName, description: "Guardado desde Studio v2", nodes, edges })
    });
    loadWorkflows();
  };

  const handleExportCode = async () => {
    if (sandboxMode) {
      setExportedCode("# Modo Sandbox activo: conecte FastAPI para transpilar topologia dinamica.\nfrom langgraph.graph import StateGraph, END");
      return;
    }
    const res = await fetch(`${API_BASE}/api/v2/workflows/export-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wfName, nodes, edges })
    });
    const data = await res.json();
    setExportedCode(data.code || "");
  };

  const handleTestRouter = async () => {
    if (sandboxMode) {
      setRouterResult({ route: "hybrid_parallel", use_rag: true, use_mcp: true, confidence: 0.94 });
      return;
    }
    const res = await fetch(`${API_BASE}/api/v2/router/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: routerQuery, has_rag: true, has_mcp: true })
    });
    setRouterResult(await res.json());
  };

  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 14, color: "#e2e8f0", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ color: "#38bdf8" }}>Enterprise Studio v2 (Multi-Agente · HITL · LangGraph)</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12 }}>
          <input type="checkbox" checked={sandboxMode} onChange={(e) => setSandboxMode(e.target.checked)} />
          Modo Sandbox (Sin Backend)
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[
          { id: "governance", label: "Gobernanza MCP & HITL" },
          { id: "router", label: "Router & Hybrid RRF" },
          { id: "workflows", label: "Topologias & LangGraph" }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: activeTab === t.id ? "#2563eb" : "#1e293b",
              color: "#fff",
              fontWeight: 600
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "governance" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <select value={userRole} onChange={e => setUserRole(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 6, borderRadius: 6 }}>
              <option value="architect">Rol: Architect (Full)</option>
              <option value="qa_auditor">Rol: QA Auditor</option>
              <option value="viewer">Rol: Viewer (Read-Only)</option>
            </select>
            <select value={testTool} onChange={e => setTestTool(e.target.value)} style={{ background: "#1e293b", color: "#fff", padding: 6, borderRadius: 6 }}>
              <option value="get_employee_benefits">Tool: get_employee_benefits (Segura)</option>
              <option value="restart_eks_pod">Tool: restart_eks_pod (Critica HITL)</option>
              <option value="approve_expense">Tool: approve_expense (Critica HITL)</option>
            </select>
            <button onClick={() => checkPolicy(false)} style={{ background: "#0ea5e9", color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
              Validar Politica
            </button>
          </div>

          {govStatus && (
            <div style={{ padding: 10, borderRadius: 6, background: govStatus.allowed ? "#064e3b" : "#7f1d1d", marginBottom: 10 }}>
              <div>{govStatus.reason}</div>
              {govStatus.requires_hitl && (
                <button onClick={() => checkPolicy(true)} style={{ marginTop: 6, background: "#f59e0b", color: "#000", fontWeight: 700, border: "none", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}>
                  Aprobar Ejecucion Humana (HITL)
                </button>
              )}
            </div>
          )}

          <div style={{ fontSize: 12, color: "#94a3b8" }}>Ultimos registros de auditoria MCP ({auditLogs.length}):</div>
          <div style={{ maxHeight: 110, overflowY: "auto", marginTop: 4, background: "#020617", padding: 6, borderRadius: 6 }}>
            {auditLogs.length === 0 ? <div>Sin invocaciones registradas aun.</div> : auditLogs.map((l, i) => (
              <div key={i} style={{ borderBottom: "1px solid #1e293b", padding: "3px 0" }}>
                [{l.user_role}] <b>{l.tool_name}</b> → {l.approval_status} ({l.latency_ms}ms)
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "router" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              value={routerQuery}
              onChange={e => setRouterQuery(e.target.value)}
              style={{ flex: 1, background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 6, padding: 6 }}
            />
            <button onClick={handleTestRouter} style={{ background: "#10b981", color: "#000", fontWeight: 700, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>
              Enrutar
            </button>
          </div>
          {routerResult && (
            <div style={{ background: "#020617", padding: 8, borderRadius: 6 }}>
              Ruta elegida: <b style={{ color: "#38bdf8" }}>{routerResult.route}</b> | RAG Hibrido (RRF): {routerResult.use_rag ? "SI" : "NO"} | MCP: {routerResult.use_mcp ? "SI" : "NO"} | Confianza: {(routerResult.confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {activeTab === "workflows" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={wfName} onChange={e => setWfName(e.target.value)} style={{ flex: 1, background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 6, padding: 6 }} />
            <button onClick={handleSaveWorkflow} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Guardar Version</button>
            <button onClick={handleExportCode} style={{ background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>Exportar LangGraph (.py)</button>
          </div>
          {workflows.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {workflows.map(w => (
                <button key={w.id} onClick={() => onLoadWorkflow && onLoadWorkflow(w.nodes, w.edges)} style={{ marginRight: 6, marginBottom: 4, background: "#1e293b", color: "#38bdf8", border: "1px solid #334155", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>
                  Cargar: {w.name} (v{w.version})
                </button>
              ))}
            </div>
          )}
          {exportedCode && (
            <pre style={{ background: "#020617", padding: 8, borderRadius: 6, maxHeight: 150, overflow: "auto", fontSize: 11, color: "#a5f3fc" }}>
              {exportedCode}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
