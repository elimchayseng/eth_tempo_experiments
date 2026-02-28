import { useState, useEffect, useRef, useCallback } from "react";
import type { LogEntry, AccountsState, WsMessage } from "../lib/types";

const RECONNECT_DELAYS = [500, 1000, 2000, 4000];

// Detect if we're running in Vercel or local development
const isVercelEnvironment = () => {
  return process.env.NODE_ENV === 'production' || window.location.hostname.includes('vercel.app');
};

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountsState>([]);
  const [connected, setConnected] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const sessionIdRef = useRef<string>('');

  // Generate or get session ID
  const getSessionId = useCallback(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = localStorage.getItem('tempo-session-id') ||
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('tempo-session-id', sessionIdRef.current);
    }
    return sessionIdRef.current;
  }, []);

  // Fetch initial accounts on mount (in case server already has state)
  useEffect(() => {
    const sessionId = getSessionId();
    fetch("/api/accounts", {
      headers: {
        'X-Session-Id': sessionId
      }
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts?.length > 0) setAccounts(data.accounts);
      })
      .catch(() => {});
  }, [getSessionId]);

  useEffect(() => {
    // Closure-scoped flag — immune to StrictMode re-mount race conditions
    let active = true;

    function connectWebSocket() {
      if (!active) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) { ws.close(); return; }
        setConnected(true);
        retryRef.current = 0;
      };

      ws.onclose = () => {
        setConnected(false);
        if (active) {
          const delay =
            RECONNECT_DELAYS[
              Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)
            ];
          retryRef.current++;
          setTimeout(connectWebSocket, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        if (!active) return;
        const msg: WsMessage = JSON.parse(event.data);
        handleMessage(msg);
      };
    }

    function connectSSE() {
      if (!active) return;

      const sessionId = getSessionId();
      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!active) { eventSource.close(); return; }
        setConnected(true);
        retryRef.current = 0;
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource.close();
        if (active) {
          const delay =
            RECONNECT_DELAYS[
              Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)
            ];
          retryRef.current++;
          setTimeout(connectSSE, delay);
        }
      };

      eventSource.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          handleSSEMessage(data);
        } catch (err) {
          console.warn('Failed to parse SSE message:', event.data);
        }
      };
    }

    function handleMessage(msg: WsMessage) {
      switch (msg.type) {
        case "log":
          setLogs((prev) => [...prev, msg.entry]);
          break;
        case "accounts":
          setAccounts(msg.accounts);
          break;
        case "action_start":
          setActiveAction(msg.action);
          break;
        case "action_complete":
          setActiveAction(null);
          break;
        case "action_error":
          setActiveAction(null);
          break;
      }
    }

    function handleSSEMessage(data: any) {
      switch (data.type) {
        case 'session_update':
          setLogs(data.logs || []);
          setAccounts(data.accounts || []);
          setActiveAction(data.activeAction);
          break;
        case 'connected':
          console.log('SSE connected with session:', data.sessionId);
          break;
        case 'heartbeat':
          // Keep connection alive
          break;
      }
    }

    // Choose connection method based on environment
    if (isVercelEnvironment()) {
      connectSSE();
    } else {
      connectWebSocket();
    }

    return () => {
      active = false;
      wsRef.current?.close();
      eventSourceRef.current?.close();
    };
  }, [getSessionId]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, accounts, connected, activeAction, clearLogs };
}
