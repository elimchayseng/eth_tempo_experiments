import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionId } from './_lib/session.js';
import { runAction } from './_lib/action-runner.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = getSessionId(req);
    const body = req.body;

    const { batchAction } = await import('../server/actions/batch.js');

    await runAction(sessionId, "batch", () => batchAction(body));

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}