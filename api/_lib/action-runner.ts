import { addLogToSession, setSessionActiveAction, updateSessionAccounts, getSession } from './session.js';

let entryCounter = 0;

function makeId(): string {
  return `log_${Date.now()}_${++entryCounter}`;
}

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
  annotations?: readonly string[];
  indent?: number;
};

export async function emitLog(sessionId: string, entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
  const full: LogEntry = {
    ...entry,
    id: makeId(),
    timestamp: Date.now(),
  };

  await addLogToSession(sessionId, full);
  return full;
}

export async function runAction<T>(
  sessionId: string,
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  await setSessionActiveAction(sessionId, action);

  try {
    // Set up session context for instrumented client
    const { setSessionContext } = await import('./instrumented-client-vercel.js');
    setSessionContext(sessionId);

    const result = await fn();

    // Import and refresh account state after action completion
    try {
      const { accountStore } = await import('../../server/accounts.js');
      if (accountStore.isInitialized()) {
        await updateSessionAccounts(sessionId, accountStore.toPublic());
      }
    } catch (err) {
      // Account store might not be initialized in serverless environment
      console.warn('Account store not available:', err);
    }

    await setSessionActiveAction(sessionId, null);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emitLog(sessionId, {
      action,
      type: "error",
      label: `Action failed: ${message}`,
      data: { error: message },
    });
    await setSessionActiveAction(sessionId, null);
    throw err;
  }
}