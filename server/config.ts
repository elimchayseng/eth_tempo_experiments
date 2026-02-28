import type { ChainConfig } from "../shared/types.js";

// Environment-based configuration
export const config = {
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 4000,
    // Railway handles host binding automatically, we just need the port
    environment: process.env.NODE_ENV || 'development',
  },

  chain: {
    chainId: 42431,
    rpcUrl: process.env.RPC_URL || "https://rpc.moderato.tempo.xyz",
    chainName: "Tempo Moderato Testnet",
    explorerUrl: process.env.EXPLORER_URL || "https://explore.moderato.tempo.xyz",
  } as ChainConfig,

  contracts: {
    alphaUsd: "0x20c0000000000000000000000000000000000001" as const,
    pathUsd: process.env.PATH_USD_ADDRESS || "0x20c0000000000000000000000000000000000000" as const,
    betaUsd: "0x20c0000000000000000000000000000000000002" as const,
    // stablecoinDex and tip20Factory addresses will be loaded from viem/tempo
  },

  limits: {
    maxWebSocketConnections: 50,
    maxPaymentsPerBatch: 10,
    requestTimeoutMs: 30000,
    maxMemoLength: 31,
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGS !== 'false',
  },
} as const;

// Validate configuration on startup
export function validateConfig(): void {
  if (!config.chain.rpcUrl || !config.chain.explorerUrl) {
    throw new Error('Missing required RPC_URL or EXPLORER_URL environment variables');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid PORT: must be between 1 and 65535');
  }

  if (config.limits.maxWebSocketConnections < 1 || config.limits.maxWebSocketConnections > 1000) {
    throw new Error('maxWebSocketConnections must be between 1 and 1000');
  }
}

// Helper to check if we're in production
export const isProduction = (): boolean => config.server.environment === 'production';