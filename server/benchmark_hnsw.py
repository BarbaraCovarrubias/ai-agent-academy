import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from server.embedding_client import generate_embedding

hnsw_router = APIRouter(prefix="/api/vector/benchmark", tags=["HNSW Benchmark"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class BenchmarkRequest(BaseModel):
    query: str
    tenant_id: str = "omnicorp"
    top_k: int = 5
    ef_search: int = 40
    iterations: int = 10

@hnsw_router.post("/hnsw-vs-knn")
async def run_hnsw_benchmark(req: BenchmarkRequest):
    vec = await generate_embedding(req.query)
    vector_literal = f"[{','.join(str(x) for x in vec)}]"

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("SELECT COUNT(*) AS total FROM corporate_documents WHERE tenant_id = %s;", (req.tenant_id,))
        total_docs = cur.fetchone()["total"]

        # 1. Fuerza Bruta k-NN (deshabilitando indexscan)
        cur.execute("SET enable_indexscan = OFF; SET enable_bitmapscan = OFF;")
        knn_times = []
        knn_results = []
        for i in range(req.iterations):
            t0 = time.perf_counter()
            cur.execute(
                """
                SELECT id, document_id, (embedding <=> %s::vector) AS dist
                FROM corporate_documents WHERE tenant_id = %s
                ORDER BY embedding <=> %s::vector ASC LIMIT %s;
                """,
                (vector_literal, req.tenant_id, vector_literal, req.top_k),
            )
            rows = cur.fetchall()
            knn_times.append((time.perf_counter() - t0) * 1000)
            if i == 0:
                knn_results = [r["id"] for r in rows]

        # 2. HNSW Indexado
        cur.execute(f"SET enable_indexscan = ON; SET enable_bitmapscan = ON; SET hnsw.ef_search = {req.ef_search};")
        hnsw_times = []
        hnsw_results = []
        for i in range(req.iterations):
            t0 = time.perf_counter()
            cur.execute(
                """
                SELECT id, document_id, (embedding <=> %s::vector) AS dist
                FROM corporate_documents WHERE tenant_id = %s
                ORDER BY embedding <=> %s::vector ASC LIMIT %s;
                """,
                (vector_literal, req.tenant_id, vector_literal, req.top_k),
            )
            rows = cur.fetchall()
            hnsw_times.append((time.perf_counter() - t0) * 1000)
            if i == 0:
                hnsw_results = [r["id"] for r in rows]

        cur.execute("EXPLAIN (FORMAT TEXT) SELECT id FROM corporate_documents ORDER BY embedding <=> %s::vector LIMIT %s;", (vector_literal, req.top_k))
        plan_lines = [r["QUERY PLAN"] for r in cur.fetchall()]
        cur.close()
        conn.close()

        avg_knn = round(sum(knn_times) / len(knn_times), 3)
        avg_hnsw = round(sum(hnsw_times) / len(hnsw_times), 3)
        speedup = round(avg_knn / max(avg_hnsw, 0.001), 2)
        overlap = len(set(knn_results).intersection(set(hnsw_results)))
        recall = round((overlap / max(len(knn_results), 1)) * 100, 1)

        return {
            "total_documents": total_docs,
            "iterations": req.iterations,
            "ef_search": req.ef_search,
            "knn_exact": {"avg_ms": avg_knn, "min_ms": round(min(knn_times), 3), "max_ms": round(max(knn_times), 3)},
            "hnsw_approx": {"avg_ms": avg_hnsw, "min_ms": round(min(hnsw_times), 3), "max_ms": round(max(hnsw_times), 3)},
            "speedup_factor": speedup,
            "recall_at_k_percent": recall,
            "explain_plan": "\n".join(plan_lines),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
