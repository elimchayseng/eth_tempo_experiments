import { useState } from "react";
import type { Account } from "../lib/types";

type Props = {
  accounts: Account[];
  activeAction: string | null;
};

async function callAction(endpoint: string, body?: Record<string, unknown>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error(`Action failed: ${res.status}`);
  }
}

function formatBalance(balance: string): string {
  const raw = BigInt(balance || "0");
  const dollars = Number(raw) / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}

export default function ActionPanel({ accounts, activeAction }: Props) {
  const [sendFrom, setSendFrom] = useState("alice");
  const [sendTo, setSendTo] = useState("bob");
  const [sendAmount, setSendAmount] = useState("5.00");
  const [sendMemo, setSendMemo] = useState("dinner last night");
  const [feeMode, setFeeMode] = useState<"self" | "sponsored">("self");

  const isRunning = activeAction !== null;
  const alphaUsd = "0x20c0000000000000000000000000000000000001";

  return (
    <div className="flex flex-col gap-6 p-4 h-full overflow-y-auto">
      {/* Accounts */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Accounts
        </h2>
        {accounts.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No accounts yet. Run Setup to create them.
          </p>
        ) : (
          <div className="space-y-1">
            {accounts.map((a) => (
              <div
                key={a.label}
                className="flex justify-between text-sm font-mono bg-gray-800/50 px-3 py-1.5 rounded"
              >
                <span className="text-gray-300">{a.label}</span>
                <span className="text-emerald-400">
                  {a.balances[alphaUsd]
                    ? formatBalance(a.balances[alphaUsd])
                    : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Actions
        </h2>
        <div className="space-y-2">
          <button
            disabled={isRunning}
            onClick={() => callAction("/api/setup")}
            className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            Setup Accounts
          </button>
          <button
            disabled={isRunning || accounts.length === 0}
            onClick={() => callAction("/api/balance")}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            Check Balances
          </button>
        </div>
      </section>

      {/* Send Payment */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Send Payment
        </h2>
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="text-xs text-gray-500">From</span>
              <select
                value={sendFrom}
                onChange={(e) => setSendFrom(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              >
                {["alice", "bob", "merchant", "sponsor"].map((n) => (
                  <option key={n} value={n}>
                    {n.charAt(0).toUpperCase() + n.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-xs text-gray-500">To</span>
              <select
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                className="w-full mt-0.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
              >
                {["alice", "bob", "merchant", "sponsor"].map((n) => (
                  <option key={n} value={n}>
                    {n.charAt(0).toUpperCase() + n.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="text-xs text-gray-500">Amount (USD)</span>
            <input
              type="text"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
            />
          </label>
          <label>
            <span className="text-xs text-gray-500">Memo</span>
            <input
              type="text"
              value={sendMemo}
              onChange={(e) => setSendMemo(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
            />
          </label>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={feeMode === "self"}
                onChange={() => setFeeMode("self")}
                className="accent-indigo-500"
              />
              Self-pay fee
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={feeMode === "sponsored"}
                onChange={() => setFeeMode("sponsored")}
                className="accent-indigo-500"
              />
              Sponsored
            </label>
          </div>
          <button
            disabled={isRunning || accounts.length === 0}
            onClick={() =>
              callAction(
                feeMode === "self" ? "/api/send" : "/api/send-sponsored",
                {
                  from: sendFrom,
                  to: sendTo,
                  amount: sendAmount,
                  memo: sendMemo,
                }
              )
            }
            className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </section>

      {/* More actions */}
      <section>
        <div className="space-y-2">
          <button
            disabled={isRunning || accounts.length === 0}
            onClick={() => callAction("/api/batch")}
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            Batch Payroll
          </button>
          <button
            disabled={isRunning || accounts.length === 0}
            onClick={() =>
              callAction("/api/history", { account: "alice" })
            }
            className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
          >
            View History
          </button>
        </div>
      </section>
    </div>
  );
}
