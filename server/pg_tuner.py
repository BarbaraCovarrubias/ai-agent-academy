import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, status

tuner_router = APIRouter(prefix="/api/vector/tuning", tags=["Postgres Vector Tuner"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

TUNING_PRESETS = {
    "standard": {
        "work_mem": "4MB",
        "maintenance_work_mem": "64MB",
        "hnsw_ef_search": 40,
        "description": "Configuración estándar balanceada para uso general.",
    },
    "benchmark_intensive": {
        "work_mem": "64MB",
        "maintenance_work_mem": "512MB",
        "hnsw_ef_search": 80,
        "description": "Optimizado para recorridos vectoriales HNSW e inserciones en masa.",
    },
    "max_performance": {
        "work_mem": "256MB",
        "maintenance_work_mem": "1GB",
        "hnsw_ef_search": 120,
        "description": "Máximo rendimiento para búsquedas k-NN sin recurrir a disco.",
    },
}

class TuningSessionPayload(BaseModel):
    work_mem: Optional[str] = Field(None, pattern=r"^\d+(MB|GB|kB)$")
    maintenance_work_mem: Optional[str] = Field(None, pattern=r"^\d+(MB|GB)$")
    hnsw_ef_search: Optional[int] = Field(None, ge=10, le=400)
    preset: Optional[str] = None

class SystemBufferPayload(BaseModel):
    shared_buffers: str = Field(..., pattern=r"^\d+(MB|GB)$")

def get_current_pg_settings() -> Dict[str, Any]:
    conn = psycopg2.connect(DATABASE_URL)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT name, setting, unit, context
            FROM pg_settings
            WHERE name IN ('work_mem', 'maintenance_work_mem', 'shared_buffers', 'hnsw.ef_search');
        """)
        rows = cur.fetchall()
    conn.close()
    settings_map = {}
    for r in rows:
        val = f"{r['setting']}{r['unit'] if r['unit'] else ''}"
        settings_map[r["name"]] = {"current_value": val, "raw_setting": r["setting"], "unit": r["unit"], "context": r["context"]}
    return settings_map

@tuner_router.get("/current")
def get_tuning_status():
    try:
        return {"active_settings": get_current_pg_settings(), "presets": TUNING_PRESETS}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tuner_router.post("/apply-session", status_code=status.HTTP_200_OK)
def apply_session_tuning(payload: TuningSessionPayload):
    target_work_mem = payload.work_mem
    target_maint_mem = payload.maintenance_work_mem
    target_ef_search = payload.hnsw_ef_search

    if payload.preset and payload.preset in TUNING_PRESETS:
        p = TUNING_PRESETS[payload.preset]
        target_work_mem = target_work_mem or p["work_mem"]
        target_maint_mem = target_maint_mem or p["maintenance_work_mem"]
        target_ef_search = target_ef_search if target_ef_search is not None else p["hnsw_ef_search"]

    applied = {}
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        with conn.cursor() as cur:
            if target_work_mem:
                cur.execute(f"ALTER DATABASE agent_academy SET work_mem = '{target_work_mem}';")
                applied["work_mem"] = target_work_mem
            if target_maint_mem:
                cur.execute(f"ALTER DATABASE agent_academy SET maintenance_work_mem = '{target_maint_mem}';")
                applied["maintenance_work_mem"] = target_maint_mem
            if target_ef_search is not None:
                cur.execute(f"ALTER DATABASE agent_academy SET hnsw.ef_search = {target_ef_search};")
                applied["hnsw.ef_search"] = target_ef_search
            cur.execute("SELECT pg_reload_conf();")
        conn.close()
        return {"status": "applied", "applied_changes": applied, "preset_used": payload.preset}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@tuner_router.post("/configure-shared-buffers", status_code=status.HTTP_202_ACCEPTED)
def configure_shared_buffers(payload: SystemBufferPayload):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(f"ALTER SYSTEM SET shared_buffers = '{payload.shared_buffers}';")
            cur.execute("SELECT pg_reload_conf();")
        conn.close()
        return {
            "status": "pending_restart",
            "configured_shared_buffers": payload.shared_buffers,
            "warning": "Registrado en postgresql.auto.conf. Requiere reiniciar el contenedor PostgreSQL para aplicarse.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
