import { useState, useEffect, useRef } from 'react';

export interface SystemMetrics {
  cpu_percent: number;
  memory_used_mb: number;
  memory_percent: number;
  reads_per_sec: number;
  cache_hits_per_sec: number;
  buffer_hit_ratio: number;
  active_connections: number;
  timestamp: string;
}

export function useMaintenanceSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [lastEvent, setLastEvent] = useState<any | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isBufferWarning, setIsBufferWarning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: any;

    const connect = () => {
      const socket = new WebSocket('ws://localhost:8000/api/vector/maintenance/ws/telemetry');
      wsRef.current = socket;

      socket.onopen = () => setIsConnected(true);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'METRICS_UPDATE') {
            setMetrics(data);
            const hasActiveIO = data.reads_per_sec > 0 || data.cache_hits_per_sec > 0;
            if (hasActiveIO && data.buffer_hit_ratio < 90.0) {
              setIsBufferWarning(true);
            } else if (data.buffer_hit_ratio >= 90.0) {
              setIsBufferWarning(false);
            }
          } else {
            setLastEvent(data);
            if (data.type === 'STATUS_INIT') setIsReindexing(Boolean(data.is_reindexing));
            else if (data.type === 'REINDEX_STARTED') setIsReindexing(true);
            else if (data.type === 'REINDEX_COMPLETED' || data.type === 'REINDEX_FAILED') setIsReindexing(false);
          }
        } catch (err) {
          console.error(err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { isConnected, isReindexing, lastEvent, metrics, isBufferWarning };
}
