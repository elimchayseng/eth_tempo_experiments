## Project Overview

Web app to understand real-time interaction log that shows every RPC call, contract interaction, transaction field, and receipt — decoded and annotated with explanations.

**Stack:**
- Backend: TypeScript, Hono (lightweight HTTP + WebSocket server), Node.js
- Frontend: Single-page React app (Vite), minimal styling (Tailwind)
- Chain interaction: `viem` with Tempo extensions (`viem/tempo`, `viem/chains`)
- Target: Tempo Testnet (chain ID `42431`, RPC `https://rpc.moderato.tempo.xyz`)

---

## Architecture

```
Browser (localhost:5173)                    Server (localhost:4000)
┌─────────────────────────────┐            ┌──────────────────────────────┐
│                             │            │                              │
│  ┌───────────┐ ┌─────────┐ │   REST +   │  Hono server                 │
│  │  Action   │ │Interact.│ │   WebSocket │                              │
│  │  Panel    │ │  Log    │ │◄──────────►│  InstrumentedClient          │
│  │           │ │         │ │            │  ├─ wraps viem client         │
│  │ [Create]  │ │ → tx... │ │            │  ├─ intercepts all RPC calls  │
│  │ [Send]    │ │ → conf..│ │            │  ├─ decodes tx fields         │
│  │ [Batch]   │ │ → ✓     │ │            │  └─ streams steps via WS     │
│  └───────────┘ └─────────┘ │            │                              │
└─────────────────────────────┘            │  AccountStore (in-memory)    │
                                           │  ├─ generated private keys   │
                                           │  └─ labels ("Alice", "Bob")  │
                                           │                              │
                                           │         viem + viem/tempo    │
                                           │              │               │
                                           └──────────────┼───────────────┘
                                                          │
                                                          ▼
                                              Tempo Testnet (42431)
                                              rpc.moderato.tempo.xyz
