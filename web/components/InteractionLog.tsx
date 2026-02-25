import { useEffect, useRef } from "react";
import type { LogEntry as LogEntryType } from "../lib/types";
import LogEntry from "./LogEntry";

type Props = {
  logs: LogEntryType[];
  onClear: () => void;
};

export default function InteractionLog({ logs, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Interaction Log
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear Log
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.length === 0 ? (
          <p className="text-gray-600 text-sm">
            Run an action to see blockchain interactions here.
          </p>
        ) : (
          logs.map((entry) => <LogEntry key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
