import { useState, useEffect, useRef, useCallback } from "react";
import type { LogEntry, AccountsState, WsMessage } from "../lib/types";

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountsState>([]);
  const [connected, setConnected] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg: WsMessage = JSON.parse(event.data);

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
    };

    return () => ws.close();
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, accounts, connected, activeAction, clearLogs };
}
