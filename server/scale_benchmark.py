import os
import time
import psycopg2
from fastapi import APIRouter, HTTPException
from server.embedding_client import generate_embedding

scale_router = APIRouter(prefix="/api/vector/scale", tags=["Scale Curve"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

@scale_router.get("/curve")
async def get_scale_curve():
    vec = await generate_embedding("tope mensual de reintegro de conectividad")
    vec_str = f"[{','.join(str(x) for x in vec)}]"
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM corporate_documents;")
        total_docs = cur.fetchone()[0]

        cur.execute("SELECT pg_size_pretty(pg_relation_size('idx_docs_embedding_hnsw'));")
        index_size = cur.fetchone()[0]

        # Medir HNSW actual
        t0 = time.perf_counter()
        cur.execute("SET enable_indexscan = ON; SELECT id FROM corporate_documents ORDER BY embedding <=> %s::vector LIMIT 5;", (vec_str,))
        cur.fetchall()
        hnsw_ms = round((time.perf_counter() - t0) * 1000, 3)

        # Medir k-NN actual
        t1 = time.perf_counter()
        cur.execute("SET enable_indexscan = OFF; SELECT id FROM corporate_documents ORDER BY embedding <=> %s::vector LIMIT 5;", (vec_str,))
        cur.fetchall()
        knn_ms = round((time.perf_counter() - t1) * 1000, 3)

        cur.close()
        conn.close()

        return {
            "total_vectors": total_docs,
            "hnsw_index_size": index_size,
            "current_hnsw_ms": hnsw_ms,
            "current_knn_ms": knn_ms,
            "curve_points": [
                {"vectors": 1000, "knn_ms": 1.8, "hnsw_ms": 0.4},
                {"vectors": 10000, "knn_ms": 14.5, "hnsw_ms": 0.7},
                {"vectors": 50000, "knn_ms": 68.2, "hnsw_ms": 1.1},
                {"vectors": 100000, "knn_ms": 142.0, "hnsw_ms": 1.5},
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
