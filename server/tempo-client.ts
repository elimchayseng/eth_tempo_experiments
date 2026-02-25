import { createPublicClient, createWalletClient, http } from "viem";
import { tempoModerato } from "viem/chains";

const transport = http("https://rpc.moderato.tempo.xyz");

export const publicClient = createPublicClient({
  chain: tempoModerato,
  transport,
});

export function createTempoWalletClient(account: any) {
  return createWalletClient({
    chain: tempoModerato,
    transport,
    account,
  });
}

export const CHAIN_CONFIG = {
  chainId: 42431,
  rpcUrl: "https://rpc.moderato.tempo.xyz",
  chainName: "Tempo Moderato Testnet",
} as const;
