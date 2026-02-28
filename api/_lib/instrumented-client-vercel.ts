// Vercel-compatible version of instrumented-client that uses session storage
import { emitLog as sessionEmitLog, type LogEntry } from './action-runner.js';
import { updateSessionAccounts } from './session.js';
import {
  type Abi,
  type Address,
  getAbiItem,
  decodeEventLog,
  type Log,
} from "viem";
import {
  publicClient,
  createTempoWalletClient,
  tip20Abi,
  CHAIN_CONFIG,
  shortAddress,
} from "../../server/tempo-client.js";
import { accountStore } from "../../server/accounts.js";

// Global session ID for current request
let currentSessionId: string = '';

export function setSessionContext(sessionId: string) {
  currentSessionId = sessionId;
}

export function emitLog(entry: Omit<LogEntry, "id" | "timestamp">): Promise<LogEntry> {
  return sessionEmitLog(currentSessionId, entry);
}

export async function emitAccounts(accounts: unknown[]) {
  await updateSessionAccounts(currentSessionId, accounts);
}

export async function instrumentedCall<T>(
  action: string,
  label: string,
  fn: () => Promise<T>,
  opts?: {
    type?: LogEntry["type"];
    annotations?: string[];
    indent?: number;
    data?: Record<string, unknown>;
  }
): Promise<T> {
  await emitLog({
    action,
    type: opts?.type ?? "info",
    label,
    data: opts?.data ?? {},
    annotations: opts?.annotations,
    indent: opts?.indent,
  });

  try {
    const result = await fn();
    return result;
  } catch (err) {
    await emitLog({
      action,
      type: "error",
      label: `${label} — failed`,
      data: { error: err instanceof Error ? err.message : String(err) },
      indent: opts?.indent,
    });
    throw err;
  }
}

export async function instrumentedReadContract<T = unknown>(
  action: string,
  opts: {
    address: Address;
    abi: Abi;
    functionName: string;
    args?: unknown[];
    label?: string;
    indent?: number;
  }
): Promise<T> {
  const { address, abi, functionName, args, indent } = opts;
  const label = opts.label ?? `Read ${functionName}`;

  await emitLog({
    action,
    type: "rpc_call",
    label: `RPC: eth_call`,
    data: {
      to: address,
      function: `${functionName}(${(args ?? []).map((a) => shortDisplay(a)).join(", ")})`,
    },
    indent,
  });

  const result = await publicClient.readContract({
    address,
    abi: abi as any,
    functionName,
    args: args as any,
  });

  await emitLog({
    action,
    type: "rpc_result",
    label: `Result: ${shortDisplay(result)}`,
    data: { raw: result },
    indent,
  });

  return result as T;
}

export async function instrumentedWriteContract(
  action: string,
  opts: {
    accountLabel: string;
    address: Address;
    abi: Abi;
    functionName: string;
    args?: unknown[];
    label?: string;
    indent?: number;
    annotations?: string[];
  }
) {
  const { accountLabel, address, abi, functionName, args, indent, annotations } = opts;
  const label = opts.label ?? `Write ${functionName}`;
  const account = accountStore.getAccount(accountLabel);
  const walletClient = createTempoWalletClient(account);

  await emitLog({
    action,
    type: "tx_built",
    label: `Building ${functionName} transaction...`,
    data: {
      contract: address,
      function: functionName,
      args: (args ?? []).map((a) => shortDisplay(a)),
      signer: `${shortAddress(account.address)} (${accountLabel})`,
    },
    indent,
  });

  await emitLog({
    action,
    type: "info",
    label: "Signing transaction...",
    data: {
      signer: `${shortAddress(account.address)} (${accountLabel})`,
      tx_type: "Tempo Transaction (EIP-2718 type 0x42)",
      chain_id: CHAIN_CONFIG.chainId,
    },
    indent: (indent ?? 0) + 1,
  });

  const hash = await walletClient.writeContract({
    address,
    abi: abi as any,
    functionName,
    args: args as any,
  });

  await emitLog({
    action,
    type: "tx_submitted",
    label: `Submitted to Tempo testnet`,
    data: {
      rpc: "eth_sendRawTransaction",
      endpoint: CHAIN_CONFIG.rpcUrl,
      tx_hash: hash,
    },
    indent,
  });

  await emitLog({
    action,
    type: "info",
    label: "Waiting for confirmation...",
    data: {},
    indent,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const decodedEvents = decodeReceiptEvents(receipt.logs, abi);

  await emitLog({
    action,
    type: "tx_confirmed",
    label: `Confirmed in block #${receipt.blockNumber} ${receipt.status === "success" ? "✓" : "✗"}`,
    data: {
      status: receipt.status,
      gas_used: receipt.gasUsed.toString(),
      block_number: receipt.blockNumber.toString(),
      events: decodedEvents,
      explorer: `${CHAIN_CONFIG.explorerUrl}/tx/${hash}`,
    },
    annotations,
    indent,
  });

  return { hash, receipt, decodedEvents };
}

export async function instrumentedSendTransaction(
  action: string,
  opts: {
    walletClient: any;
    accountLabel: string;
    request: Record<string, unknown>;
    label?: string;
    indent?: number;
    annotations?: string[];
  }
) {
  const { walletClient, accountLabel, request, indent, annotations } = opts;
  const label = opts.label ?? "Send transaction";

  await emitLog({
    action,
    type: "tx_submitted",
    label: `Submitting to Tempo testnet...`,
    data: {
      rpc: "eth_sendRawTransaction",
      endpoint: CHAIN_CONFIG.rpcUrl,
      sender: accountLabel,
      ...request,
    },
    indent,
  });

  const hash = await walletClient.sendTransaction(request as any);

  await emitLog({
    action,
    type: "info",
    label: `tx_hash: ${hash}`,
    data: { tx_hash: hash },
    indent: (indent ?? 0) + 1,
  });

  await emitLog({
    action,
    type: "info",
    label: "Waiting for confirmation...",
    data: {},
    indent,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const decodedEvents = decodeReceiptEvents(receipt.logs, tip20Abi);

  await emitLog({
    action,
    type: "tx_confirmed",
    label: `Confirmed in block #${receipt.blockNumber} ${receipt.status === "success" ? "✓" : "✗"}`,
    data: {
      status: receipt.status,
      gas_used: receipt.gasUsed.toString(),
      block_number: receipt.blockNumber.toString(),
      events: decodedEvents,
      explorer: `${CHAIN_CONFIG.explorerUrl}/tx/${hash}`,
    },
    annotations,
    indent,
  });

  return { hash, receipt, decodedEvents };
}

export async function instrumentedGetLogs(
  action: string,
  opts: {
    address: Address;
    abi: Abi;
    eventName: string;
    args?: Record<string, unknown>;
    fromBlock?: bigint;
    toBlock?: bigint | "latest";
    label?: string;
    indent?: number;
  }
) {
  const { address, abi, eventName, args, fromBlock, toBlock, indent } = opts;
  const label = opts.label ?? `Query ${eventName} events`;

  await emitLog({
    action,
    type: "rpc_call",
    label: "RPC: eth_getLogs",
    data: {
      address,
      event: eventName,
      filter: args ?? "none",
      from_block: fromBlock?.toString() ?? "latest-1000",
      to_block: toBlock?.toString() ?? "latest",
    },
    indent,
  });

  const logs = await publicClient.getLogs({
    address,
    event: getAbiItem({ abi: abi as any, name: eventName }) as any,
    args: args as any,
    fromBlock: fromBlock ?? "earliest",
    toBlock: toBlock ?? "latest",
  });

  await emitLog({
    action,
    type: "rpc_result",
    label: `Found ${logs.length} events`,
    data: { count: logs.length },
    indent,
  });

  return logs;
}

function decodeReceiptEvents(logs: Log[], abi: Abi): Record<string, unknown>[] {
  const decoded: Record<string, unknown>[] = [];
  for (const log of logs) {
    try {
      const event: any = decodeEventLog({
        abi: abi as any,
        data: log.data,
        topics: log.topics,
      });
      decoded.push({
        event: event.eventName,
        args: Object.fromEntries(
          Object.entries(event.args ?? {}).map(([k, v]) => [k, shortDisplay(v)])
        ),
      });
    } catch {
      // Skip events that don't match the provided ABI
    }
  }
  return decoded;
}

function shortDisplay(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") {
    if (value.startsWith("0x") && value.length > 20) {
      return shortAddress(value);
    }
    return value;
  }
  if (Array.isArray(value)) return `[${value.map(shortDisplay).join(", ")}]`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}