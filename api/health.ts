import type { VercelRequest, VercelResponse } from '@vercel/node';
import { publicClient, CHAIN_CONFIG } from '../server/tempo-client.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chainId = await publicClient.getChainId();
    const blockNumber = await publicClient.getBlockNumber();

    res.status(200).json({
      status: "ok",
      chain: {
        id: chainId,
        name: CHAIN_CONFIG.chainName,
        rpc: CHAIN_CONFIG.rpcUrl,
        latestBlock: blockNumber.toString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}