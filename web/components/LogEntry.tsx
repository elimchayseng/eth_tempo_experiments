import type { LogEntry as LogEntryType } from "../lib/types";
import AnnotationBox from "./AnnotationBox";

type Props = {
  entry: LogEntryType;
};

const TYPE_STYLES: Record<string, string> = {
  info: "text-gray-300",
  rpc_call: "text-blue-400",
  rpc_result: "text-cyan-400",
  tx_built: "text-yellow-400",
  tx_submitted: "text-orange-400",
  tx_confirmed: "text-emerald-400",
  error: "text-red-400",
  annotation: "text-indigo-300",
};

const TYPE_ICONS: Record<string, string> = {
  info: "\u2192",
  rpc_call: "\u250C",
  rpc_result: "\u2514",
  tx_built: "\u250C",
  tx_submitted: "\u251C",
  tx_confirmed: "\u2714",
  error: "\u2718",
  annotation: "\uD83D\uDCA1",
};

export default function LogEntry({ entry }: Props) {
  const indent = entry.indent ?? 0;
  const paddingLeft = indent * 20;
  const style = TYPE_STYLES[entry.type] || "text-gray-300";
  const icon = TYPE_ICONS[entry.type] || "\u2192";

  return (
    <div className="group" style={{ paddingLeft }}>
      <div className={`font-mono text-sm ${style} leading-relaxed`}>
        <span className="opacity-50 mr-1">{icon}</span>
        <span>{entry.label}</span>
      </div>

      {/* Show data fields */}
      {Object.keys(entry.data).length > 0 && entry.type !== "annotation" && (
        <div
          className="ml-5 mt-0.5 space-y-0 font-mono text-xs text-gray-500"
          style={{ paddingLeft }}
        >
          {Object.entries(entry.data).map(([key, value]) => (
            <div key={key}>
              <span className="text-gray-600">{key}:</span>{" "}
              <span className="text-gray-400">
                {typeof value === "object"
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Annotations */}
      {entry.annotations && entry.annotations.length > 0 && (
        <div className="mt-1" style={{ paddingLeft }}>
          <AnnotationBox annotations={entry.annotations} />
        </div>
      )}
    </div>
  );
}
