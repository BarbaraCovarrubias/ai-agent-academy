import os
import io
import psycopg2
from psycopg2.extras import execute_values
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Query, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from pypdf import PdfReader
from server.embedding_client import generate_embedding
from server.reindex_service import check_and_trigger_auto_reindex

pdf_router = APIRouter(prefix="/api/documents", tags=["Document Ingestion & Indexing"])

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

def recursive_chunk_text(text: str, chunk_size: int = 500, chunk_overlap: int = 50) -> List[str]:
    separators = ["\n\n", "\n", ". ", " ", ""]

    def split_into_segments(content: str, sep_idx: int) -> List[str]:
        if len(content) <= chunk_size or sep_idx >= len(separators):
            return [content] if content.strip() else []
        sep = separators[sep_idx]
        if sep == "":
            return [content[i:i + chunk_size] for i in range(0, len(content), chunk_size - chunk_overlap)]
        splits = content.split(sep)
        chunks = []
        current_chunk = ""
        for part in splits:
            part_str = part + sep
            if len(current_chunk) + len(part_str) <= chunk_size:
                current_chunk += part_str
            else:
                if current_chunk.strip():
                    chunks.append(current_chunk.strip())
                if len(part_str) > chunk_size:
                    chunks.extend(split_into_segments(part_str, sep_idx + 1))
                    current_chunk = ""
                else:
                    overlap_seed = current_chunk[-chunk_overlap:] if len(current_chunk) >= chunk_overlap else ""
                    current_chunk = overlap_seed + part_str
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        return chunks

    return split_into_segments(text, 0)

class IngestionResponse(BaseModel):
    status: str
    filename: str
    tenant_id: str
    total_pages: int
    chunks_created: int
    embedding_provider: str
    embedding_model: str

class ChunkInspectItem(BaseModel):
    id: int
    document_id: str
    tenant_id: str
    category: str
    content: str
    char_count: int
    estimated_tokens: int
    vector: List[float]

@pdf_router.post("/index-pdf", response_model=IngestionResponse, status_code=status.HTTP_201_CREATED)
async def upload_and_index_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    tenant_id: str = Form("omnicorp"),
    category: str = Form("general"),
    chunk_size: int = Form(500),
    chunk_overlap: int = Form(50),
    embedding_provider: str = Form("mock"),
    embedding_model: str = Form("text-embedding-3-small"),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se admiten archivos PDF.")

    try:
        pdf_bytes = await file.read()
        reader = PdfReader(io.BytesIO(pdf_bytes))
        total_pages = len(reader.pages)
        raw_text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                raw_text += extracted + "\n\n"
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error al parsear PDF: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="El PDF no contiene texto legible.")

    chunks = recursive_chunk_text(raw_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    db_rows = []
    base_doc_id = os.path.splitext(file.filename)[0]

    for idx, chunk in enumerate(chunks):
        vec = await generate_embedding(text=chunk, provider=embedding_provider, model=embedding_model)
        vector_literal = f"[{','.join(str(x) for x in vec)}]"
        db_rows.append((f"{base_doc_id}_c{idx + 1}", tenant_id, category, chunk, vector_literal))

    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            execute_values(
                cur,
                "INSERT INTO corporate_documents (document_id, tenant_id, category, content, embedding) VALUES %s;",
                db_rows,
                template="(%s, %s, %s, %s, %s::vector)",
            )
            conn.commit()
        conn.close()
    except psycopg2.Error as db_err:
        raise HTTPException(status_code=500, detail=f"Error PostgreSQL: {str(db_err)}")

    check_and_trigger_auto_reindex(inserted_batch_count=len(chunks), background_tasks=background_tasks)

    return IngestionResponse(
        status="success",
        filename=file.filename,
        tenant_id=tenant_id,
        total_pages=total_pages,
        chunks_created=len(chunks),
        embedding_provider=embedding_provider,
        embedding_model=embedding_model,
    )

@pdf_router.get("/chunks", response_model=List[ChunkInspectItem])
def list_document_chunks(
    document_id: Optional[str] = Query(None),
    tenant_id: str = Query("omnicorp"),
    limit: int = Query(50, le=100),
):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn.cursor() as cur:
            if document_id:
                cur.execute(
                    """
                    SELECT id, document_id, tenant_id, category, content, embedding::text
                    FROM corporate_documents
                    WHERE tenant_id = %s AND (document_id LIKE %s OR document_id = %s)
                    ORDER BY id ASC LIMIT %s;
                    """,
                    (tenant_id, f"{document_id}%", document_id, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, document_id, tenant_id, category, content, embedding::text
                    FROM corporate_documents
                    WHERE tenant_id = %s
                    ORDER BY id ASC LIMIT %s;
                    """,
                    (tenant_id, limit),
                )
            rows = cur.fetchall()
        conn.close()

        results = []
        for r in rows:
            raw_vec_str = r[5].strip("[]")
            parsed_vector = [float(x.strip()) for x in raw_vec_str.split(",") if x.strip()] if raw_vec_str else []
            content = r[4]
            results.append(
                ChunkInspectItem(
                    id=r[0],
                    document_id=r[1],
                    tenant_id=r[2],
                    category=r[3],
                    content=content,
                    char_count=len(content),
                    estimated_tokens=max(1, len(content) // 4),
                    vector=parsed_vector,
                )
            )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando chunks: {str(e)}")
