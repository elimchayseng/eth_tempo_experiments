import type { VercelRequest } from '@vercel/node';
import { memoryStore } from './memory-store.js';

// Try to import Upstash Redis, fall back to memory store for local development
let redis: typeof memoryStore;
try {
  const { Redis } = require('@upstash/redis');

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    redis = {
      get: async (key: string) => await client.get(key),
      set: async (key: string, value: any, options?: { ex?: number }) => {
        if (options?.ex) {
          await client.set(key, value, { ex: options.ex });
        } else {
          await client.set(key, value);
        }
      },
      clear: async () => {
        // This is not typically used, but included for compatibility
      }
    };
  } else {
    redis = memoryStore;
  }
} catch {
  redis = memoryStore;
}

export interface Session {
  id: string;
  logs: any[];
  accounts: any[];
  activeAction: string | null;
}

export function getSessionId(req: VercelRequest): string {
  // Try to get session ID from headers, cookies, or query params
  const sessionId =
    req.headers['x-session-id'] ||
    req.query.sessionId ||
    req.cookies?.sessionId ||
    'default';

  return String(sessionId);
}

export async function getSession(sessionId: string): Promise<Session> {
  try {
    const session = await redis.get(`session:${sessionId}`);
    if (session) {
      return session as Session;
    }
  } catch (error) {
    // Fall back to default if Redis is not available (local development)
    console.warn('Redis not available, using in-memory storage');
  }

  // Return default session
  return {
    id: sessionId,
    logs: [],
    accounts: [],
    activeAction: null,
  };
}

export async function saveSession(session: Session): Promise<void> {
  try {
    await redis.set(`session:${session.id}`, session, { ex: 3600 }); // 1 hour expiration
  } catch (error) {
    // Silent failure for local development
    console.warn('Redis not available, session not persisted');
  }
}

export async function addLogToSession(sessionId: string, logEntry: any): Promise<void> {
  const session = await getSession(sessionId);
  session.logs.push(logEntry);

  // Keep only last 1000 logs to prevent memory issues
  if (session.logs.length > 1000) {
    session.logs = session.logs.slice(-1000);
  }

  await saveSession(session);
}

export async function updateSessionAccounts(sessionId: string, accounts: any[]): Promise<void> {
  const session = await getSession(sessionId);
  session.accounts = accounts;
  await saveSession(session);
}

export async function setSessionActiveAction(sessionId: string, action: string | null): Promise<void> {
  const session = await getSession(sessionId);
  session.activeAction = action;
  await saveSession(session);
}