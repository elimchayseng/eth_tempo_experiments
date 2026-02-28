import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionId, getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = getSessionId(req);
    const session = await getSession(sessionId);

    res.status(200).json({
      accounts: session.accounts
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err)
    });
  }
}