import { useWebSocket } from "./hooks/useWebSocket";
import ActionPanel from "./components/ActionPanel";
import InteractionLog from "./components/InteractionLog";

export default function App() {
  const { logs, accounts, connected, activeAction, clearLogs } =
    useWebSocket();

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900">
        <h1 className="text-lg font-bold tracking-tight">Tempo Explorer</h1>
        <div className="flex items-center gap-3">
          {activeAction && (
            <span className="text-xs text-yellow-400 animate-pulse">
              Running: {activeAction}
            </span>
          )}
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-red-500"
            }`}
            title={connected ? "WebSocket connected" : "Disconnected"}
          />
        </div>
      </header>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Actions */}
        <aside className="w-72 border-r border-gray-800 bg-gray-900/50 flex-shrink-0">
          <ActionPanel accounts={accounts} activeAction={activeAction} />
        </aside>

        {/* Right: Log */}
        <main className="flex-1 min-w-0">
          <InteractionLog logs={logs} onClear={clearLogs} />
        </main>
      </div>
    </div>
  );
}
