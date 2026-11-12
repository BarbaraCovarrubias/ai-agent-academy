import os
import time
import math
import random
import psycopg2
from psycopg2.extras import execute_values
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, BackgroundTasks
from server.reindex_service import check_and_trigger_auto_reindex

seed_router = APIRouter(prefix="/api/vector/scale", tags=["Scale & Synthetic Seeding"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class SeedScaleRequest(BaseModel):
    count: int = Field(default=10000, ge=100, le=100000)
    tenant_id: str = "omnicorp"
    batch_size: int = 5000

class SeedScaleResponse(BaseModel):
    status: str
    tenant_id: str
    inserted_count: int
    batch_size: int
    elapsed_seconds: float
    vectors_per_second: float

@seed_router.post("/populate", response_model=SeedScaleResponse)
def populate_scale_vectors(req: SeedScaleRequest, background_tasks: BackgroundTasks):
    start_time = time.time()
    total = req.count
    batch_size = req.batch_size
    tenant = req.tenant_id

    categories = ["reintegros", "vacaciones", "seguridad", "normativas", "beneficios"]

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        inserted = 0
        while inserted < total:
            current_batch = min(batch_size, total - inserted)
            rows = []
            for i in range(current_batch):
                idx = inserted + i + 1
                cat = categories[idx % len(categories)]
                raw_v = [random.uniform(0.05, 0.95) for _ in range(4)]
                norm = math.sqrt(sum(x * x for x in raw_v))
                vec = [round(x / norm, 4) for x in raw_v]
                vec_str = f"[{','.join(str(x) for x in vec)}]"
                rows.append((f"synth_{idx}", tenant, cat, f"Política corporativa sintética #{idx} ({cat}).", vec_str))

            execute_values(
                cur,
                "INSERT INTO corporate_documents (document_id, tenant_id, category, content, embedding) VALUES %s;",
                rows,
                template="(%s, %s, %s, %s, %s::vector)",
            )
            conn.commit()
            inserted += current_batch

        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error poblando vectores: {str(e)}")

    check_and_trigger_auto_reindex(inserted_batch_count=total, background_tasks=background_tasks)

    elapsed = round(time.time() - start_time, 2)
    rate = round(total / max(elapsed, 0.01), 1)

    return SeedScaleResponse(
        status="success",
        tenant_id=tenant,
        inserted_count=total,
        batch_size=batch_size,
        elapsed_seconds=elapsed,
        vectors_per_second=rate,
    )

@seed_router.delete("/purge-synthetic")
def purge_synthetic_vectors():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("DELETE FROM corporate_documents WHERE document_id LIKE 'synth_%';")
        deleted = cur.rowcount
        conn.commit()
        cur.close()
        conn.close()
        return {"status": "purged", "deleted_count": deleted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
