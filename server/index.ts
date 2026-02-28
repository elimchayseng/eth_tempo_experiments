import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import {
  addClient,
  removeClient,
  runAction,
  emitLog,
} from "./instrumented-client.js";
import { publicClient, CHAIN_CONFIG } from "./tempo-client.js";
import { accountStore } from "./accounts.js";
import { setupAction } from "./actions/setup.js";
import { balanceAction } from "./actions/balance.js";
import { sendAction } from "./actions/send.js";
import { sendSponsoredAction } from "./actions/send-sponsored.js";
import { batchAction } from "./actions/batch.js";
import { historyAction } from "./actions/history.js";

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Middleware
app.use("/*", cors());

// WebSocket endpoint
app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      console.log("[ws] client connected");
      addClient(ws);
    },
    onClose(_event, ws) {
      console.log("[ws] client disconnected");
      removeClient(ws);
    },
  }))
);

// Health check — also verifies testnet connectivity
app.get("/api/health", async (c) => {
  try {
    const chainId = await publicClient.getChainId();
    const blockNumber = await publicClient.getBlockNumber();
    return c.json({
      status: "ok",
      chain: {
        id: chainId,
        name: CHAIN_CONFIG.chainName,
        rpc: CHAIN_CONFIG.rpcUrl,
        latestBlock: blockNumber.toString(),
      },
    });
  } catch (err) {
    return c.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});

// Return current accounts state (for initial frontend load)
app.get("/api/accounts", (c) => {
  return c.json({ accounts: accountStore.toPublic() });
});

// ---------------------------------------------------------------------------
// Action routes — each wraps its logic in runAction() which handles
// the action_start / action_complete / action_error lifecycle and
// broadcasts account updates after completion.
// ---------------------------------------------------------------------------

app.post("/api/setup", async (c) => {
  try {
    await runAction("setup", setupAction);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/balance", async (c) => {
  try {
    await runAction("balance", balanceAction);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/send", async (c) => {
  try {
    const body = await c.req.json();
    await runAction("send", () => sendAction(body));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/send-sponsored", async (c) => {
  try {
    const body = await c.req.json();
    await runAction("send-sponsored", () => sendSponsoredAction(body));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/batch", async (c) => {
  try {
    const body = await c.req.json();
    await runAction("batch", () => batchAction(body));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

app.post("/api/history", async (c) => {
  try {
    const body = await c.req.json();
    await runAction("history", () => historyAction(body));
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const port = 4000;
const server = serve({ fetch: app.fetch, port });
injectWebSocket(server);

console.log(`[tempo-explorer] Server running on http://localhost:${port}`);
console.log(`[tempo-explorer] WebSocket on ws://localhost:${port}/ws`);
console.log(
  `[tempo-explorer] Targeting ${CHAIN_CONFIG.chainName} (chain ${CHAIN_CONFIG.chainId})`
);
