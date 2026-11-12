import os
import httpx
from dotenv import load_dotenv

load_dotenv()

CURRENT_CONFIG = {
    "provider": os.getenv("LLM_PROVIDER", "mock"),
    "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
    "ollama_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
}

async def call_llm(
    prompt: str,
    system_prompt: str = "Eres un asistente técnico preciso.",
    temperature: float = 0.2,
    max_tokens: int = 512,
) -> str:
    provider = CURRENT_CONFIG["provider"]
    if provider == "mock":
        return f"[Mock LLM] Procesado: {prompt[:120]}..."
    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY no configurada en .env")
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": CURRENT_CONFIG["openai_model"],
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"]
    if provider == "ollama":
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                f"{CURRENT_CONFIG['ollama_url']}/api/chat",
                json={
                    "model": CURRENT_CONFIG["ollama_model"],
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                },
            )
            res.raise_for_status()
            return res.json()["message"]["content"]
    raise ValueError(f"Proveedor no soportado: {provider}")
