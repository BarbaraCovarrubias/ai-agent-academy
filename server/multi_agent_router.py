import re

def classify_intent(query: str, has_rag: bool = True, has_mcp: bool = True) -> dict:
    q = query.lower()
    mcp_keywords = ["saldo", "vacaciones", "reintegro", "pod", "eks", "kafka", "lag", "deploy", "kpi", "estado"]
    rag_keywords = ["politica", "norma", "manual", "articulo", "procedimiento", "tope", "requisito", "contrato"]

    needs_mcp = has_mcp and any(k in q for k in mcp_keywords)
    needs_rag = has_rag and (any(k in q for k in rag_keywords) or not needs_mcp)

    if needs_mcp and needs_rag:
        route = "hybrid_parallel"
    elif needs_mcp:
        route = "mcp_only"
    else:
        route = "rag_only"

    return {
        "route": route,
        "use_rag": needs_rag,
        "use_mcp": needs_mcp,
        "confidence": 0.94 if (needs_mcp or needs_rag) else 0.78
    }

def rewrite_query_for_reflection(original_query: str, attempt: int = 1) -> str:
    tokens = [w for w in re.findall(r"\w+", original_query.lower()) if len(w) > 3]
    expanded = " ".join(dict.fromkeys(tokens))
    return f"{original_query} | contexto normativo detallado ({expanded}) [reintento #{attempt}]"
