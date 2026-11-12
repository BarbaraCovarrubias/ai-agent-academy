import os
import psycopg2
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel
from typing import List
from fastapi import APIRouter, HTTPException
from server.embedding_client import generate_embedding

pgvector_router = APIRouter(prefix="/api/vector", tags=["pgvector Engine"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class VectorSearchRequest(BaseModel):
    query: str
    tenant_id: str = "omnicorp"
    top_k: int = 3
    embedding_provider: str = "mock"
    embedding_model: str = "text-embedding-3-small"

class DocumentMatch(BaseModel):
    id: int
    document_id: str
    category: str
    content: str
    distance: float
    score: float

@pgvector_router.post("/search", response_model=List[DocumentMatch])
async def search_pgvector(req: VectorSearchRequest):
    try:
        query_vector = await generate_embedding(
            text=req.query,
            provider=req.embedding_provider,
            model=req.embedding_model,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fallo al computar embedding: {str(e)}")

    vector_literal = f"[{','.join(str(x) for x in query_vector)}]"

    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, document_id, category, content, (embedding <=> %s::vector) AS distance
                FROM corporate_documents
                WHERE tenant_id = %s
                ORDER BY embedding <=> %s::vector ASC
                LIMIT %s;
                """,
                (vector_literal, req.tenant_id, vector_literal, req.top_k),
            )
            rows = cur.fetchall()
        conn.close()

        results = []
        for r in rows:
            dist = float(r["distance"])
            score = round(max(0.0, 1.0 - dist), 4)
            results.append(
                DocumentMatch(
                    id=r["id"],
                    document_id=r["document_id"],
                    category=r["category"],
                    content=r["content"],
                    distance=round(dist, 4),
                    score=score,
                )
            )
        return results
    except psycopg2.Error as db_err:
        raise HTTPException(status_code=500, detail=f"Error PostgreSQL/pgvector: {str(db_err)}")
