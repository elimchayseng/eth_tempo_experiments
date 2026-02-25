import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { addClient, removeClient } from "./instrumented-client.js";
import { publicClient, CHAIN_CONFIG } from "./tempo-client.js";

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

// Placeholder routes for future actions
app.post("/api/setup", async (c) => c.json({ todo: "phase 2" }));
app.post("/api/balance", async (c) => c.json({ todo: "phase 4" }));
app.post("/api/send", async (c) => c.json({ todo: "phase 4" }));
app.post("/api/send-sponsored", async (c) => c.json({ todo: "phase 5" }));
app.post("/api/batch", async (c) => c.json({ todo: "phase 6" }));
app.post("/api/history", async (c) => c.json({ todo: "phase 7" }));

const port = 4000;
const server = serve({ fetch: app.fetch, port });
injectWebSocket(server);

console.log(`[tempo-explorer] Server running on http://localhost:${port}`);
console.log(`[tempo-explorer] WebSocket on ws://localhost:${port}/ws`);
console.log(`[tempo-explorer] Targeting ${CHAIN_CONFIG.chainName} (chain ${CHAIN_CONFIG.chainId})`);
