import type { WSContext } from "hono/ws";

export type LogEntry = {
  id: string;
  timestamp: number;
  action: string;
  type:
    | "info"
    | "rpc_call"
    | "rpc_result"
    | "tx_built"
    | "tx_submitted"
    | "tx_confirmed"
    | "error"
    | "annotation";
  label: string;
  data: Record<string, unknown>;
  annotations?: string[];
  indent?: number;
};

let entryCounter = 0;

function makeId(): string {
  return `log_${Date.now()}_${++entryCounter}`;
}

// Tracks all connected WebSocket clients
const clients = new Set<WSContext>();

export function addClient(ws: WSContext) {
  clients.add(ws);
}

export function removeClient(ws: WSContext) {
  clients.delete(ws);
}

function broadcast(message: Record<string, unknown>) {
  const json = JSON.stringify(message);
  for (const ws of clients) {
    try {
      ws.send(json);
    } catch {
      clients.delete(ws);
    }
  }
}

export function emitLog(entry: Omit<LogEntry, "id" | "timestamp">) {
  const full: LogEntry = {
    ...entry,
    id: makeId(),
    timestamp: Date.now(),
  };
  broadcast({ type: "log", entry: full });
  return full;
}

export function emitActionStart(action: string) {
  broadcast({ type: "action_start", action });
}

export function emitActionComplete(action: string) {
  broadcast({ type: "action_complete", action });
}

export function emitActionError(action: string, error: string) {
  broadcast({ type: "action_error", action, error });
}

export function emitAccounts(accounts: unknown[]) {
  broadcast({ type: "accounts", accounts });
}

/**
 * Instrumented wrapper — executes an async function while streaming
 * step_start / step_complete / step_error log entries over WebSocket.
 */
export async function instrumentedCall<T>(
  action: string,
  label: string,
  fn: () => Promise<T>,
  opts?: { annotations?: string[]; indent?: number; data?: Record<string, unknown> }
): Promise<T> {
  emitLog({
    action,
    type: "info",
    label,
    data: opts?.data ?? {},
    indent: opts?.indent,
  });

  try {
    const result = await fn();
    return result;
  } catch (err) {
    emitLog({
      action,
      type: "error",
      label: `${label} — failed`,
      data: { error: err instanceof Error ? err.message : String(err) },
      indent: opts?.indent,
    });
    throw err;
  }
}
