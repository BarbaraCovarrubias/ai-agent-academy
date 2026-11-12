import math
import hashlib
from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

emb_router = APIRouter(prefix="/api/embeddings", tags=["Embeddings"])

class EmbeddingRequest(BaseModel):
    text: str
    provider: str = "mock"
    model: str = "text-embedding-3-small"

def _deterministic_4d_embedding(text: str) -> List[float]:
    t = text.lower()
    v = [0.1, 0.1, 0.1, 0.1]
    if any(k in t for k in ["vacaciones", "antigüedad", "días", "licencia"]):
        v[0] += 0.85
    if any(k in t for k in ["reintegro", "internet", "conectividad", "guardería", "tope", "remoto"]):
        v[1] += 0.88
    if any(k in t for k in ["manual", "política", "normativa", "procedimiento"]):
        v[2] += 0.70
    if any(k in t for k in ["seguridad", "zero trust", "biométrica", "servidor", "producción"]):
        v[3] += 0.92
    digest = hashlib.sha256(t.encode("utf-8")).digest()
    for i in range(4):
        v[i] += (digest[i] / 255.0) * 0.08
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [round(x / norm, 4) for x in v]

async def generate_embedding(text: str, provider: str = "mock", model: str = "text-embedding-3-small") -> List[float]:
    return _deterministic_4d_embedding(text)

@emb_router.post("/generate")
async def api_generate_embedding(req: EmbeddingRequest):
    vec = await generate_embedding(req.text, req.provider, req.model)
    return {"vector": vec, "dimensions": len(vec), "provider": req.provider}
