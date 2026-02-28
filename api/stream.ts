import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionId, getSession } from './_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = getSessionId(req);

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Set up polling to send updates
  const pollInterval = setInterval(async () => {
    try {
      const session = await getSession(sessionId);

      // Send session data
      res.write(`data: ${JSON.stringify({
        type: 'session_update',
        logs: session.logs,
        accounts: session.accounts,
        activeAction: session.activeAction
      })}\n\n`);
    } catch (error) {
      console.error('Error polling session:', error);
    }
  }, 1000); // Poll every second

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(pollInterval);
  });

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
  }, 30000); // Heartbeat every 30 seconds

  req.on('close', () => {
    clearInterval(heartbeat);
  });
}