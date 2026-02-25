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

export type Account = {
  label: string;
  address: string;
  balances: Record<string, string>; // token address → formatted balance
};

export type AccountsState = Account[];

export type WsMessage =
  | { type: "log"; entry: LogEntry }
  | { type: "accounts"; accounts: AccountsState }
  | { type: "action_start"; action: string }
  | { type: "action_complete"; action: string }
  | { type: "action_error"; action: string; error: string };
