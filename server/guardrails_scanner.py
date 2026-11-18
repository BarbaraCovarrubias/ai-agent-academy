import re
from typing import Dict, Any, List

INJECTION_PATTERNS = [
    (r"(?i)ignora\s+(todas\s+)?(las\s+)?instrucciones\s+anteriores", "Override de instrucciones del sistema", 45),
    (r"(?i)ignore\s+(all\s+)?previous\s+instructions", "System prompt override (EN)", 45),
    (r"(?i)(ejecuta|llama\s+a|invoca|run|call)\s+(la\s+tool\s+|herramienta\s+)?(restart_eks_pod|approve_expense|drop_table|exec)", "Invocación forzada de tool crítica vía contexto", 50),
    (r"(?i)(revela|muestra|imprime|leak)\s+(el\s+)?(system\s+prompt|api[_\s]?key|token|secret)", "Exfiltración de secretos / System Prompt", 40),
    (r"(?i)<\|im_start\|>|\[INST\]|###\s*SYSTEM", "Inyección de delimitadores de rol LLM", 35),
]

PII_PATTERNS = [
    ("EMAIL", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[EMAIL_REDACTED]"),
    ("DNI_AR", r"\b\d{2}\.\d{3}\.\d{3}\b|\b\d{7,8}\b", "[DNI_REDACTED]"),
    ("BEARER_TOKEN", r"(?i)(Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*|sk-[A-Za-z0-9]{20,})", "[SECRET_TOKEN_REDACTED]"),
    ("CREDIT_CARD", r"\b(?:\d{4}[- ]?){3}\d{4}\b", "[CARD_REDACTED]"),
]

def scan_rag_payload(text: str, redact_pii: bool = True, block_threshold: int = 40) -> Dict[str, Any]:
    findings: List[Dict[str, Any]] = []
    risk_score = 0

    for pattern, label, weight in INJECTION_PATTERNS:
        matches = re.findall(pattern, text)
        if matches:
            risk_score += weight
            findings.append({
                "type": "PROMPT_INJECTION",
                "severity": "HIGH" if weight >= 40 else "MEDIUM",
                "rule": label,
                "weight": weight,
            })

    sanitized_text = text
    pii_detected: List[str] = []

    for pii_type, pattern, replacement in PII_PATTERNS:
        if re.search(pattern, sanitized_text):
            pii_detected.append(pii_type)
            risk_score += 15
            findings.append({
                "type": "PII_EXPOSURE",
                "severity": "MEDIUM",
                "rule": f"Dato sensible detectado: {pii_type}",
                "weight": 15,
            })
            if redact_pii:
                sanitized_text = re.sub(pattern, replacement, sanitized_text)

    risk_score = min(100, risk_score)
    blocked = risk_score >= block_threshold and any(f["type"] == "PROMPT_INJECTION" for f in findings)

    return {
        "safe": not blocked,
        "blocked": blocked,
        "risk_score": risk_score,
        "findings": findings,
        "pii_detected": pii_detected,
        "sanitized_text": sanitized_text,
        "recommendation": (
            "BLOQUEADO: Se detectó Indirect Prompt Injection en los chunks recuperados. Se aborta la invocación al LLM y tools MCP."
            if blocked
            else ("SANITIZADO: PII enmascarado antes de enviar al LLM." if pii_detected else "LIMPIO: Sin amenazas ni fuga de datos sensibles.")
        ),
    }
