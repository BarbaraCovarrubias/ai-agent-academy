import os
import time
import logging
import psycopg2
from typing import Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from server.ws_manager import ws_manager

logger = logging.getLogger("agent_academy.maintenance")

reindex_router = APIRouter(prefix="/api/vector/maintenance", tags=["Vector Maintenance"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

INDEX_NAME = "idx_docs_embedding_hnsw"
TABLE_NAME = "corporate_documents"
AUTO_REINDEX_THRESHOLD = 50000

MAINTENANCE_STATE = {
    "pending_inserts_count": 0,
    "is_reindexing": False,
    "last_auto_reindex_at": None,
    "total_auto_runs": 0,
}

class ReindexStatusResponse(BaseModel):
    status: str
    index_name: str
    table_name: str
    elapsed_seconds: float
    previous_size: str
    current_size: str
    total_vectors: int

def get_index_metrics(cur) -> Dict[str, Any]:
    cur.execute("SELECT pg_size_pretty(pg_relation_size(%s));", (INDEX_NAME,))
    size = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM corporate_documents;")
    count = cur.fetchone()[0]
    return {"size": size, "count": count}

def execute_reindex_sync_task():
    if MAINTENANCE_STATE["is_reindexing"]:
        return

    MAINTENANCE_STATE["is_reindexing"] = True
    start_time = time.time()

    ws_manager.broadcast_from_sync({
        "type": "REINDEX_STARTED",
        "timestamp": time.strftime("%H:%M:%S"),
        "index_name": INDEX_NAME,
        "message": "Optimizando grafo HNSW en segundo plano...",
    })

    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()

        initial_metrics = get_index_metrics(cur)
        prev_size = initial_metrics["size"]

        cur.execute(f"REINDEX INDEX CONCURRENTLY {INDEX_NAME};")
        cur.execute(f"ANALYZE {TABLE_NAME};")

        final_metrics = get_index_metrics(cur)
        curr_size = final_metrics["size"]
        total_vectors = final_metrics["count"]

        cur.close()
        conn.close()

        elapsed = round(time.time() - start_time, 2)
        MAINTENANCE_STATE["pending_inserts_count"] = 0
        MAINTENANCE_STATE["last_auto_reindex_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        MAINTENANCE_STATE["total_auto_runs"] += 1

        ws_manager.broadcast_from_sync({
            "type": "REINDEX_COMPLETED",
            "timestamp": time.strftime("%H:%M:%S"),
            "elapsed_seconds": elapsed,
            "previous_size": prev_size,
            "current_size": curr_size,
            "total_vectors": total_vectors,
            "message": f"Grafo HNSW compactado a {curr_size} en {elapsed}s.",
        })
    except Exception as e:
        logger.error(f"Error crítico en reindex: {e}")
        ws_manager.broadcast_from_sync({
            "type": "REINDEX_FAILED",
            "timestamp": time.strftime("%H:%M:%S"),
            "error": str(e),
            "message": "Fallo durante la optimización concurrente de HNSW.",
        })
    finally:
        MAINTENANCE_STATE["is_reindexing"] = False

def check_and_trigger_auto_reindex(inserted_batch_count: int, background_tasks: BackgroundTasks):
    MAINTENANCE_STATE["pending_inserts_count"] += inserted_batch_count
    pending = MAINTENANCE_STATE["pending_inserts_count"]
    if pending >= AUTO_REINDEX_THRESHOLD and not MAINTENANCE_STATE["is_reindexing"]:
        background_tasks.add_task(execute_reindex_sync_task)

@reindex_router.post("/reindex-hnsw", response_model=ReindexStatusResponse)
def reindex_hnsw_concurrently():
    start_time = time.time()
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        initial_metrics = get_index_metrics(cur)
        prev_size = initial_metrics["size"]
        total_docs = initial_metrics["count"]

        cur.execute(f"REINDEX INDEX CONCURRENTLY {INDEX_NAME};")
        cur.execute(f"ANALYZE {TABLE_NAME};")

        final_metrics = get_index_metrics(cur)
        curr_size = final_metrics["size"]
        cur.close()
        conn.close()
    except psycopg2.Error as db_err:
        raise HTTPException(status_code=500, detail=f"Fallo optimizando HNSW: {str(db_err)}")

    return ReindexStatusResponse(
        status="optimized",
        index_name=INDEX_NAME,
        table_name=TABLE_NAME,
        elapsed_seconds=round(time.time() - start_time, 2),
        previous_size=prev_size,
        current_size=curr_size,
        total_vectors=total_docs,
    )

@reindex_router.get("/auto-status")
def get_auto_maintenance_status():
    return {
        "pending_inserts": MAINTENANCE_STATE["pending_inserts_count"],
        "threshold": AUTO_REINDEX_THRESHOLD,
        "is_reindexing": MAINTENANCE_STATE["is_reindexing"],
        "last_auto_reindex_at": MAINTENANCE_STATE["last_auto_reindex_at"],
        "total_auto_runs": MAINTENANCE_STATE["total_auto_runs"],
        "progress_percentage": round(
            min(100.0, (MAINTENANCE_STATE["pending_inserts_count"] / AUTO_REINDEX_THRESHOLD) * 100), 2
        ),
    }

@reindex_router.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "STATUS_INIT",
            "is_reindexing": MAINTENANCE_STATE["is_reindexing"],
            "pending_inserts": MAINTENANCE_STATE["pending_inserts_count"],
            "threshold": AUTO_REINDEX_THRESHOLD,
            "total_auto_runs": MAINTENANCE_STATE["total_auto_runs"],
        })
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
