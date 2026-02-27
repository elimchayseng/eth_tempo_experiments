import { toHex } from "viem";
import { Actions, Abis } from "viem/tempo";
import { accountStore } from "../accounts.js";
import {
  publicClient,
  createTempoWalletClient,
  ALPHA_USD,
  PATH_USD,
  CHAIN_CONFIG,
  TIP20_DECIMALS,
  parseUsdAmount,
  formatUsdAmount,
  shortAddress,
} from "../tempo-client.js";
import { emitLog } from "../instrumented-client.js";
import { annotations } from "../annotations.js";

const ACTION = "send";

export async function sendAction(params: {
  from: string;
  to: string;
  amount: string;
  memo: string;
}) {
  const { from, to, amount, memo } = params;

  // -----------------------------------------------------------------------
  // Step 1: Parse and validate parameters
  // -----------------------------------------------------------------------
  const senderAcct = accountStore.get(from);
  const recipientAcct = accountStore.get(to);
  if (!senderAcct) throw new Error(`Unknown sender account: ${from}`);
  if (!recipientAcct) throw new Error(`Unknown recipient account: ${to}`);
  if (senderAcct.label === recipientAcct.label) {
    throw new Error("Cannot send to yourself");
  }

  const rawAmount = parseUsdAmount(amount);

  emitLog({
    action: ACTION,
    type: "info",
    label: `Preparing payment: ${senderAcct.label} → ${recipientAcct.label}`,
    data: {
      from: `${senderAcct.label} (${shortAddress(senderAcct.address)})`,
      to: `${recipientAcct.label} (${shortAddress(recipientAcct.address)})`,
      amount: `$${amount}`,
      raw_amount: rawAmount.toString(),
      decimals: TIP20_DECIMALS,
    },
  });

  // -----------------------------------------------------------------------
  // Step 2: Encode memo to hex (bytes32 on-chain)
  // -----------------------------------------------------------------------
  const memoHex = toHex(memo);

  emitLog({
    action: ACTION,
    type: "info",
    label: `Encoding memo → bytes32`,
    data: {
      original: memo,
      hex: memoHex,
      note: "TIP-20 memos are bytes32 — stored on-chain as part of the TransferWithMemo event",
    },
    indent: 1,
  });

  // -----------------------------------------------------------------------
  // Step 3: Read balances before transfer
  // -----------------------------------------------------------------------
  emitLog({
    action: ACTION,
    type: "rpc_call",
    label: "RPC: eth_call × 3 — reading AlphaUSD + sender pathUSD balances",
    data: {
      tokens: { AlphaUSD: ALPHA_USD, pathUSD: PATH_USD },
      note: "Fee is paid in pathUSD (the network's base fee token)",
    },
  });

  const [senderBalanceBefore, recipientBalanceBefore, senderPathBefore] =
    await Promise.all([
      publicClient.readContract({
        address: ALPHA_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [senderAcct.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: ALPHA_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [recipientAcct.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: PATH_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [senderAcct.address],
      }) as Promise<bigint>,
    ]);

  emitLog({
    action: ACTION,
    type: "rpc_result",
    label: `Balances before`,
    data: {
      [`${senderAcct.label} (AlphaUSD)`]: `$${formatUsdAmount(senderBalanceBefore)}`,
      [`${recipientAcct.label} (AlphaUSD)`]: `$${formatUsdAmount(recipientBalanceBefore)}`,
      [`${senderAcct.label} (pathUSD)`]: `$${formatUsdAmount(senderPathBefore)}`,
    },
    indent: 1,
  });

  // -----------------------------------------------------------------------
  // Step 4: Execute transferWithMemo via TIP-20 contract
  // -----------------------------------------------------------------------
  const senderViemAccount = accountStore.getAccount(from);
  const walletClient = createTempoWalletClient(senderViemAccount);

  emitLog({
    action: ACTION,
    type: "tx_built",
    label: `Building transferWithMemo transaction`,
    data: {
      contract: ALPHA_USD,
      function: "transferWithMemo(address, uint256, bytes32)",
      args: {
        to: shortAddress(recipientAcct.address),
        amount: `${rawAmount.toString()} (= $${amount})`,
        memo: memoHex,
      },
      signer: `${shortAddress(senderAcct.address)} (${senderAcct.label})`,
      fee_payer: `self — ${senderAcct.label} pays the fee`,
    },
  });

  emitLog({
    action: ACTION,
    type: "info",
    label: "Signing and submitting to Tempo testnet...",
    data: {
      signer: `${senderAcct.label} (${shortAddress(senderAcct.address)})`,
      fee_payer: "self (sender pays fee in AlphaUSD)",
      endpoint: CHAIN_CONFIG.rpcUrl,
    },
    indent: 1,
  });

  // Use feePayer: sender (self-sponsorship) to ensure Tempo transaction type (0x76).
  // This keeps all transactions in the same format, which is required for
  // compatibility with subsequent sponsored sends on the same account.
  const result = await Actions.token.transferSync(walletClient, {
    token: ALPHA_USD,
    to: recipientAcct.address,
    amount: rawAmount,
    memo: memoHex as `0x${string}`,
    feePayer: senderViemAccount,
  } as any);

  emitLog({
    action: ACTION,
    type: "tx_submitted",
    label: `Transaction submitted`,
    data: {
      tx_hash: result.receipt.transactionHash,
      rpc: "eth_sendRawTransaction",
      endpoint: CHAIN_CONFIG.rpcUrl,
    },
    indent: 1,
  });

  emitLog({
    action: ACTION,
    type: "tx_confirmed",
    label: `Confirmed in block #${result.receipt.blockNumber} ✓`,
    data: {
      status: result.receipt.status,
      tx_hash: result.receipt.transactionHash,
      block_number: result.receipt.blockNumber.toString(),
      gas_used: result.receipt.gasUsed.toString(),
      transfer_event: {
        from: shortAddress(result.from),
        to: shortAddress(result.to),
        amount: `${result.amount.toString()} (= $${formatUsdAmount(result.amount)})`,
        memo: memoHex,
      },
      explorer: `${CHAIN_CONFIG.explorerUrl}/tx/${result.receipt.transactionHash}`,
    },
  });

  emitLog({
    action: ACTION,
    type: "annotation",
    label: "KEY CONCEPT",
    data: {},
    annotations: annotations.send.memo,
  });

  // -----------------------------------------------------------------------
  // Step 5: Read balances after and show changes
  // -----------------------------------------------------------------------
  emitLog({
    action: ACTION,
    type: "rpc_call",
    label: "RPC: eth_call × 3 — reading balances after transfer",
    data: {
      note: "Checking AlphaUSD balances + sender's pathUSD (fee token)",
    },
  });

  const [senderBalanceAfter, recipientBalanceAfter, senderPathAfter] =
    await Promise.all([
      publicClient.readContract({
        address: ALPHA_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [senderAcct.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: ALPHA_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [recipientAcct.address],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: PATH_USD,
        abi: Abis.tip20,
        functionName: "balanceOf",
        args: [senderAcct.address],
      }) as Promise<bigint>,
    ]);

  // Update account store
  accountStore.updateBalance(senderAcct.label, ALPHA_USD, senderBalanceAfter);
  accountStore.updateBalance(recipientAcct.label, ALPHA_USD, recipientBalanceAfter);

  const senderAlphaDiff = senderBalanceBefore - senderBalanceAfter;
  const recipientDiff = recipientBalanceAfter - recipientBalanceBefore;
  const senderPathDiff = senderPathBefore - senderPathAfter;

  emitLog({
    action: ACTION,
    type: "rpc_result",
    label: `Balance changes`,
    data: {
      [`${senderAcct.label} (AlphaUSD)`]: {
        before: `$${formatUsdAmount(senderBalanceBefore)}`,
        after: `$${formatUsdAmount(senderBalanceAfter)}`,
        change: `−$${formatUsdAmount(senderAlphaDiff)}`,
        note: "Transfer amount only — no fee in AlphaUSD!",
      },
      [recipientAcct.label + " (AlphaUSD)"]: {
        before: `$${formatUsdAmount(recipientBalanceBefore)}`,
        after: `$${formatUsdAmount(recipientBalanceAfter)}`,
        change: `+$${formatUsdAmount(recipientDiff)}`,
      },
      [`${senderAcct.label} (pathUSD — fee)`]: {
        before: `$${formatUsdAmount(senderPathBefore)}`,
        after: `$${formatUsdAmount(senderPathAfter)}`,
        change: `−$${formatUsdAmount(senderPathDiff)}`,
        note: `Fee of $${formatUsdAmount(senderPathDiff)} paid in pathUSD`,
      },
    },
  });

  emitLog({
    action: ACTION,
    type: "annotation",
    label: "KEY CONCEPT",
    data: {},
    annotations: annotations.send.fee,
  });

  emitLog({
    action: ACTION,
    type: "annotation",
    label: "KEY CONCEPT",
    data: {},
    annotations: annotations.send.comparison,
  });
}
