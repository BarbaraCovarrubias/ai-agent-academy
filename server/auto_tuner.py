import os
import platform
import psutil
import psycopg2
from pydantic import BaseModel, Field
from typing import Dict
from fastapi import APIRouter, HTTPException, status

auto_tuner_router = APIRouter(prefix="/api/vector/auto-tune", tags=["Postgres Auto-Tuner"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class HostHardwareProfile(BaseModel):
    os_name: str
    total_ram_bytes: int
    total_ram_gb: float
    available_ram_gb: float
    cpu_cores_logical: int
    cpu_cores_physical: int

class RecommendedTuningProfile(BaseModel):
    shared_buffers: str
    effective_cache_size: str
    maintenance_work_mem: str
    work_mem: str
    hnsw_ef_search: int
    max_connections: int
    rationale: Dict[str, str]

class AutoTuneCalculationResponse(BaseModel):
    host_profile: HostHardwareProfile
    recommended_config: RecommendedTuningProfile

class ApplyAutoTuneRequest(BaseModel):
    apply_session_only: bool = Field(default=False)

def inspect_host_hardware() -> HostHardwareProfile:
    mem = psutil.virtual_memory()
    return HostHardwareProfile(
        os_name=platform.system(),
        total_ram_bytes=mem.total,
        total_ram_gb=round(mem.total / (1024 ** 3), 2),
        available_ram_gb=round(mem.available / (1024 ** 3), 2),
        cpu_cores_logical=psutil.cpu_count(logical=True) or 2,
        cpu_cores_physical=psutil.cpu_count(logical=False) or 1,
    )

def calculate_optimal_pg_settings(hw: HostHardwareProfile) -> RecommendedTuningProfile:
    total_mb = int(hw.total_ram_bytes / (1024 * 1024))
    is_windows = hw.os_name.lower() == "windows"
    sb_ratio = 0.125 if is_windows else 0.25
    shared_buffers_mb = min(max(int(total_mb * sb_ratio), 128), 8192)
    effective_cache_mb = max(int(total_mb * 0.75), 512)
    maint_work_mem_mb = min(max(int(total_mb * 0.05), 64), 2048)
    assumed_max_connections = 50
    free_margin_mb = max(128, total_mb - shared_buffers_mb)
    work_mem_mb = min(max(int(free_margin_mb / (assumed_max_connections * 3)), 16), 128)
    ef_search = 80 if total_mb >= 8192 else (60 if total_mb >= 4096 else 40)

    return RecommendedTuningProfile(
        shared_buffers=f"{shared_buffers_mb}MB",
        effective_cache_size=f"{effective_cache_mb}MB",
        maintenance_work_mem=f"{maint_work_mem_mb}MB",
        work_mem=f"{work_mem_mb}MB",
        hnsw_ef_search=ef_search,
        max_connections=assumed_max_connections,
        rationale={
            "shared_buffers": f"{int(sb_ratio * 100)}% de RAM ({shared_buffers_mb}MB) para clusters vectoriales calientes.",
            "effective_cache_size": f"75% de RAM ({effective_cache_mb}MB) para el planificador de costes.",
            "maintenance_work_mem": f"5% ({maint_work_mem_mb}MB) para acelerar REINDEX CONCURRENTLY.",
            "work_mem": f"{work_mem_mb}MB por ordenamiento k-NN para 50 conexiones sin disco temporal.",
            "hnsw_ef_search": f"Calibrado en {ef_search} según capacidad del host.",
        },
    )

@auto_tuner_router.get("/plan", response_model=AutoTuneCalculationResponse)
def get_auto_tuning_plan():
    hw = inspect_host_hardware()
    return AutoTuneCalculationResponse(host_profile=hw, recommended_config=calculate_optimal_pg_settings(hw))

@auto_tuner_router.post("/apply", status_code=status.HTTP_200_OK)
def apply_auto_tuning(req: ApplyAutoTuneRequest):
    hw = inspect_host_hardware()
    config = calculate_optimal_pg_settings(hw)
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"ALTER DATABASE agent_academy SET work_mem = '{config.work_mem}';")
        cur.execute(f"ALTER DATABASE agent_academy SET maintenance_work_mem = '{config.maintenance_work_mem}';")
        cur.execute(f"ALTER DATABASE agent_academy SET hnsw.ef_search = {config.hnsw_ef_search};")
        requires_restart = False
        if not req.apply_session_only:
            cur.execute(f"ALTER SYSTEM SET shared_buffers = '{config.shared_buffers}';")
            cur.execute(f"ALTER SYSTEM SET effective_cache_size = '{config.effective_cache_size}';")
            requires_restart = True
        cur.execute("SELECT pg_reload_conf();")
        cur.close()
        conn.close()
        return {
            "status": "success",
            "requires_restart": requires_restart,
            "message": "Ajustes aplicados. " + ("Reinicia el contenedor PostgreSQL para shared_buffers." if requires_restart else "Activos en sesión."),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
