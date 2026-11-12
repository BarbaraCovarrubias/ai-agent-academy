import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from server.ws_manager import ws_manager
from server.metrics_collector import metrics_sampler
from server.llm_client import CURRENT_CONFIG
from server.embedding_client import emb_router
from server.pgvector_search import pgvector_router
from server.pdf_indexer import pdf_router
from server.benchmark_hnsw import hnsw_router
from server.scale_benchmark import scale_router
from server.seed_scale import seed_router
from server.reindex_service import reindex_router
from server.pg_tuner import tuner_router
from server.auto_tuner import auto_tuner_router
from server.ragas_evaluator import ragas_router
from server.batch_evaluator import batch_router
from server.report_generator import report_router
from server.chat_runner import chat_router

async def telemetry_broadcast_loop():
    while True:
        try:
            if ws_manager.active_connections:
                payload = metrics_sampler.sample()
                await ws_manager.broadcast(payload)
        except Exception as e:
            print(f"[!] Error telemetría: {e}")
        await asyncio.sleep(2.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    ws_manager.set_loop(loop)
    telemetry_task = asyncio.create_task(telemetry_broadcast_loop())
    yield
    telemetry_task.cancel()

app = FastAPI(title="AI Agent Academy — Enterprise RAG Engine", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProviderSwitchRequest(BaseModel):
    provider: str
    model: str | None = None

@app.get("/api/health")
def health_check():
    return {"status": "ok", "active_provider": CURRENT_CONFIG["provider"]}

@app.post("/api/config/provider")
def switch_llm_provider(req: ProviderSwitchRequest):
    CURRENT_CONFIG["provider"] = req.provider
    if req.model:
        if req.provider == "openai":
            CURRENT_CONFIG["openai_model"] = req.model
        elif req.provider == "ollama":
            CURRENT_CONFIG["ollama_model"] = req.model
    return {"status": "updated", "config": CURRENT_CONFIG}

app.include_router(emb_router)
app.include_router(pgvector_router)
app.include_router(pdf_router)
app.include_router(hnsw_router)
app.include_router(scale_router)
app.include_router(seed_router)
app.include_router(reindex_router)
app.include_router(tuner_router)
app.include_router(auto_tuner_router)
app.include_router(ragas_router)
app.include_router(batch_router)
app.include_router(report_router)
app.include_router(chat_router)
