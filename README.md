# AI Agent Academy — Enterprise RAG & MCP Studio

> **Estudio visual interactivo de ingeniería de Inteligencia Artificial Generativa** para diseñar, orquestar, estresar y auditar pipelines **RAG (Retrieval-Augmented Generation)** y conectores **MCP (Model Context Protocol)** sobre **PostgreSQL + `pgvector`**, con validación topológica DAG en tiempo real, telemetría WebSocket y evaluación automatizada **RAGAS**.

---

## Descripción y Objetivos del Proyecto

**AI Agent Academy** es un laboratorio de arquitectura de IA (*Enterprise AI Sandbox*) diseñado para cerrar la brecha entre los prototipos de chatbots básicos y las arquitecturas agénticas listas para producción.

### Objetivos Principales
1. **Orquestación Visual Basada en Grafos (DAG):** Construir flujos RAG y agénticos mediante bloques arrastrables en React Flow, validando en tiempo real la dirección de las conexiones, detectando nodos huérfanos y bloqueando ciclos o rutas inválidas.
2. **Ingeniería de Búsqueda Vectorial a Escala:** Contrastar empíricamente el rendimiento de índices aproximados **HNSW** (*Hierarchical Navigable Small World*) frente a búsquedas exactas por fuerza bruta (**Exact k-NN**) bajo volúmenes de hasta 100.000 vectores.
3. **Observabilidad y Auto-Tuning de Infraestructura:** Monitorear en tiempo real CPU, RAM, *Buffer Hit Ratio* y lecturas de disco (`blks/s`) de PostgreSQL vía WebSockets, aplicando ajustes matemáticos óptimos de memoria (`work_mem`, `maintenance_work_mem`, `hnsw.ef_search`).
4. **Integración Agéntica vía MCP (Model Context Protocol):** Descubrir (`tools/list`) e invocar (`tools/call`) herramientas externas mediante el estándar JSON-RPC 2.0, combinando contexto documental no estructurado con datos transaccionales en vivo.
5. **Aseguramiento de Calidad con RAGAS:** Auditar cada turno de conversación mediante una **implementación ligera propia inspirada en las métricas de RAGAS** (*Faithfulness*, *Answer Relevance* y *Context Precision*) con generación de informes ejecutivos.

---

## Alcance Funcional

| Módulo | Capacidades Implementadas |
| :--- | :--- |
| **Canvas Visual & Validador DAG** | Paleta lateral *Drag & Drop* (`Document Loader`, `Embedding Gen`, `pgvector Store`, `MCP Tool Client`, `Prompt Template`, `LLM Engine`). Validación topológica en vivo con resaltado de errores en nodos y ejecución estricta por aristas conectadas. |
| **Ingesta & Chunking** | Carga de archivos PDF reales desde el navegador, extracción de texto con `pypdf`, fragmentación recursiva (*Recursive Character Splitting*) y almacenamiento vectorial en PostgreSQL. |
| **Multi-LLM & Embeddings Switcher** | Conmutación en caliente entre **Simulador Mock**, **OpenAI** (`gpt-4o-mini` / `text-embedding-3-small`) y **Ollama** (`llama3.2` / `nomic-embed-text`) con control dinámico de temperatura y `Top-K`. |
| **MCP Client Bridge** | Conector compatible con servidores MCP HTTP/JSON-RPC 2.0 y servidores integrados (`builtin://omnicorp-erp`, `builtin://devops-telemetry`) para descubrimiento e invocación de herramientas. |
| **Benchmarking & Escala 100k** | Generación masiva de vectores sintéticos, comparación de latencia HNSW vs. Exact k-NN con `EXPLAIN PLAN` real, ajuste de `hnsw.ef_search` y `REINDEX INDEX CONCURRENTLY` automático/manual. |
| **Telemetry & PG Memory Tuner** | Muestreo cada 2s mediante `psutil` y `pg_stat_database` transmitido por WebSockets, alertas de saturación de *Buffer Pool* (`< 90%` Hit Ratio) y calibración automática según el hardware del host. |
| **RAGAS QA & Reporting** | Evaluación turno a turno en el chat en vivo + suite por lotes (*Batch Evaluation*) con casos factuales, abstención documental y defensa ante *prompt injection*, exportable a reporte HTML/PDF. |

---

## Stack Tecnológico

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Flow, Zustand, Lucide Icons.
* **Backend:** Python 3.12+, FastAPI, Uvicorn (ASGI), Pydantic v2, HTTPX, `pypdf`, `psutil`, WebSockets.
* **Base de Datos Vectorial:** PostgreSQL 16 + extensión `pgvector` (índice HNSW con distancia coseno `<=>`), `psycopg2-binary`.
* **Infraestructura & Contenedores:** Docker & Docker Compose.
* **Proveedores IA & Protocolos:** OpenAI API, Ollama Local REST API, Model Context Protocol (MCP JSON-RPC 2.0), Framework RAGAS.

---
## Diagramas de Arquitectura y Flujo

### 1. Arquitectura Técnica del Sistema

```text
+-----------------------------------------------------------------------------------+
|                    FRONTEND — React 18 + Vite + Tailwind (:5173)                  |
|                                                                                   |
|  [Node Palette Sidebar] --(Drag & Drop)--> [React Flow DAG Canvas + Validator]    |
|                                                      ^                            |
|  [PG Engine Telemetry Widget] <--------------+       |                            |
|  [Modals: Chunks / HNSW / Scale / RAGAS] <---+--> [Zustand Global Store]          |
|                                                      ^                            |
|  [Live Chat & RAGAS Drawer] -------------------------+                            |
+------------------------------------+----------------------------------------------+
                                     | REST (/api/chat/run) & WebSocket (/ws/telemetry)
                                     v
+-----------------------------------------------------------------------------------+
|                      BACKEND — FastAPI ASGI Engine (:8000)                        |
|                                                                                   |
|  +---------------------------+      +------------------------------------------+  |
|  |   Live Pipeline Runner    |----->| MCP Client Bridge (JSON-RPC 2.0)         |  |
|  | (Filtro Ancestros DAG)    |      | -> tools/list & tools/call               |  |
|  +-------------+-------------+      +------------------------------------------+  |
|                |                                                                  |
|                +-------------------> [RAGAS Evaluator] (Faithfulness / Relevance) |
|                                                                                   |
|  [Postgres Metrics Sampler (psutil)] --(Cada 2s)--> [WebSocket Connection Mgr]    |
+----------------+-----------------------------------+------------------------------+
                 | SQL Cosine Distance (<=>)         | HTTPS / REST Inference
                 v                                   v
+----------------------------------+   +--------------------------------------------+
|   DOCKER INFRASTRUCTURE          |   |   EXTERNAL AI & MCP PROVIDERS              |
|                                  |   |                                            |
|  [( PostgreSQL 16 + pgvector )]  |   |  * OpenAI API (gpt-4o-mini / embeddings)   |
|  * Tabla: corporate_documents    |   |  * Ollama Local (llama3.2 / nomic-embed)   |
|  * Indice: idx_docs_embedding_hnsw|  |  * Servidores MCP (Builtin / HTTP)         |
+----------------------------------+   +--------------------------------------------+

[ Document Loader (PDF) ] ----+
                              +--> [( pgvector HNSW Store )] --(Top-K Chunks)--+
[ Embedding Generator ] ------+                                                |
                                                                               v
[ MCP Tool Client ] ---------------(tools/list & tools/call)---------> [ Prompt Template ]
                                                                               |
                                                                               v
[ Auditoria RAGAS ] <-------------(Score Compuesto & Veredicto)------- [ LLM Engine ]

[ Document Loader (PDF) ] ----+
                              +--> [( pgvector HNSW Store )] --(Top-K Chunks)--+
[ Embedding Generator ] ------+                                                |
                                                                               v
[ MCP Tool Client ] ---------------(tools/list & tools/call)---------> [ Prompt Template ]
                                                                               |
                                                                               v
[ Auditoria RAGAS ] <-------------(Score Compuesto & Veredicto)------- [ LLM Engine ]


---

## 🚀 Novedades Enterprise v2 (`feat/enterprise-v2`)

Esta rama evoluciona el estudio visual hacia una arquitectura lista para entornos corporativos auditables:

1. **Búsqueda Híbrida (HNSW + Full-Text BM25) con RRF y Reranker (`server/hybrid_reranker.py`):** Combina similitud vectorial en `pgvector` con búsqueda léxica en PostgreSQL (`tsvector` / `ts_rank_cd`) mediante *Reciprocal Rank Fusion* (RRF) y reordenamiento por relevancia semántica.
2. **Router Multi-Agente y Auto-Reflexión (`server/multi_agent_router.py`):** Clasifica dinámicamente la intención de cada consulta entre `rag_only`, `mcp_only` o `hybrid_parallel`, e incluye reescritura de consultas (*Self-Correction Loop*).
3. **Gobernanza MCP, RBAC y *Human-in-the-Loop* (`server/mcp_governance.py`):** Control de permisos por rol (`architect`, `qa_auditor`, `viewer`), bloqueo preventivo con aprobación humana explícita para herramientas críticas (`restart_eks_pod`, `approve_expense`, etc.) y registro de auditoría en PostgreSQL (`mcp_audit_logs`).
4. **Persistencia de Topologías y Exportador a LangGraph (`server/workflow_exporter.py`):** Versionado de arquitecturas en base de datos (`saved_workflows`) y transpilación directa del grafo visual a código Python ejecutable con `StateGraph` de LangGraph.
5. **Enterprise Studio v2 & UI Responsiva (`src/components/EnterpriseStudioPanel.jsx`):** Panel integrado con modo *Sandbox* (sin backend), paneles laterales redimensionables con tiradores arrastrables y suite de pruebas automatizadas con `pytest` (`tests/test_v2_pillars.py`).
