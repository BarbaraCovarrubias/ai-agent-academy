import os
import time
import psutil
import psycopg2
from typing import Dict, Any

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://academy_admin:academy_secure_pass_2026@localhost:5432/agent_academy",
)

class PostgresMetricsSampler:
    def __init__(self):
        self.last_sample_time = time.time()
        self.last_blks_read = 0
        self.last_blks_hit = 0
        self._init_baseline()

    def _init_baseline(self):
        try:
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("""
                SELECT COALESCE(SUM(blks_read), 0), COALESCE(SUM(blks_hit), 0)
                FROM pg_stat_database WHERE datname = 'agent_academy';
            """)
            row = cur.fetchone()
            self.last_blks_read = row[0]
            self.last_blks_hit = row[1]
            self.last_sample_time = time.time()
            cur.close()
            conn.close()
        except Exception:
            pass

    def sample(self) -> Dict[str, Any]:
        now = time.time()
        dt = max(now - self.last_sample_time, 0.1)
        cpu_pct = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        mem_used_mb = round((mem.total - mem.available) / (1024 * 1024), 1)
        mem_pct = mem.percent

        disk_reads_per_sec = 0.0
        cache_hits_per_sec = 0.0
        active_connections = 0

        try:
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("""
                SELECT COALESCE(SUM(blks_read), 0), COALESCE(SUM(blks_hit), 0), COALESCE(SUM(numbackends), 0)
                FROM pg_stat_database WHERE datname = 'agent_academy';
            """)
            row = cur.fetchone()
            current_read, current_hit, active_connections = row[0], row[1], row[2]
            disk_reads_per_sec = round(max(0, current_read - self.last_blks_read) / dt, 1)
            cache_hits_per_sec = round(max(0, current_hit - self.last_blks_hit) / dt, 1)
            self.last_blks_read = current_read
            self.last_blks_hit = current_hit
            self.last_sample_time = now
            cur.close()
            conn.close()
        except Exception:
            pass

        total_ops = disk_reads_per_sec + cache_hits_per_sec
        buffer_hit_ratio = round((cache_hits_per_sec / total_ops * 100), 1) if total_ops > 0 else 99.0

        return {
            "type": "METRICS_UPDATE",
            "timestamp": time.strftime("%H:%M:%S"),
            "cpu_percent": cpu_pct,
            "memory_used_mb": mem_used_mb,
            "memory_percent": mem_pct,
            "reads_per_sec": disk_reads_per_sec,
            "cache_hits_per_sec": cache_hits_per_sec,
            "buffer_hit_ratio": buffer_hit_ratio,
            "active_connections": active_connections,
        }

metrics_sampler = PostgresMetricsSampler()
