import os, re, psycopg2
from psycopg2.extras import RealDictCursor

DB_URL = os.getenv("DATABASE_URL", "postgresql://academy_admin:academy_pass@localhost:5432/agent_academy")

def compute_rrf(vec_rows: dict, fts_rows: dict, query: str, top_k: int = 3, rrf_k: int = 60, use_reranker: bool = True):
    all_ids = set(vec_rows.keys()) | set(fts_rows.keys())
    fused = []
    q_terms = set(re.findall(r"\w+", query.lower()))

    for doc_id in all_ids:
        base = vec_rows.get(doc_id) or fts_rows.get(doc_id)
        v_rank = vec_rows[doc_id]["vec_rank"] if doc_id in vec_rows else 1000
        f_rank = fts_rows[doc_id]["fts_rank"] if doc_id in fts_rows else 1000
        rrf_score = (1.0 / (rrf_k + v_rank)) + (1.0 / (rrf_k + f_rank))

        c_terms = set(re.findall(r"\w+", base["content"].lower()))
        overlap = len(q_terms & c_terms) / max(len(q_terms), 1)
        rerank_score = round((rrf_score * 35) + (overlap * 0.65), 4)

        fused.append({
            "id": base["id"],
            "document_id": base.get("document_id", f"doc_{doc_id}"),
            "category": base.get("category", "general"),
            "content": base["content"],
            "vec_rank": v_rank if v_rank < 1000 else None,
            "fts_rank": f_rank if f_rank < 1000 else None,
            "rrf_score": round(rrf_score, 5),
            "rerank_score": rerank_score,
            "final_score": rerank_score if use_reranker else round(rrf_score, 5)
        })

    fused.sort(key=lambda x: x["final_score"], reverse=True)
    return fused[:top_k]

def hybrid_search_rrf(query: str, query_embedding: list[float], top_k: int = 3, use_reranker: bool = True):
    conn = psycopg2.connect(DB_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            fetch_limit = max(top_k * 3, 10)
            vec_str = "[" + ",".join(map(str, query_embedding)) + "]"
            cur.execute("""
                SELECT id, document_id, category, content,
                       ROW_NUMBER() OVER (ORDER BY embedding <=> %s::vector ASC) AS vec_rank
                FROM corporate_documents LIMIT %s;
            """, (vec_str, fetch_limit))
            vec_rows = {r["id"]: dict(r) for r in cur.fetchall()}

            clean_q = " | ".join(re.findall(r"\w+", query.lower())) or "politica"
            cur.execute("""
                SELECT id, document_id, category, content,
                       ROW_NUMBER() OVER (ORDER BY ts_rank_cd(content_tsv, to_tsquery('spanish', %s)) DESC) AS fts_rank
                FROM corporate_documents
                WHERE content_tsv @@ to_tsquery('spanish', %s) LIMIT %s;
            """, (clean_q, clean_q, fetch_limit))
            fts_rows = {r["id"]: dict(r) for r in cur.fetchall()}
            return compute_rrf(vec_rows, fts_rows, query, top_k=top_k, use_reranker=use_reranker)
    finally:
        conn.close()
