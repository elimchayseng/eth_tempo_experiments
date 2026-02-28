# Vercel Deployment Guide

This project has been refactored to work with both local development (using WebSockets) and Vercel deployment (using Server-Sent Events and Redis).

## Architecture Changes

### For Vercel Deployment:
- **API Routes**: Converted from Hono server to Vercel serverless functions in `/api` directory
- **Real-time Communication**: Replaced WebSockets with Server-Sent Events (SSE)
- **State Management**: Session-based storage using Upstash Redis
- **Environment Detection**: Automatic switching between local WebSocket and Vercel SSE

### For Local Development:
- **Server**: Original Hono server with WebSockets (`npm run dev:server`)
- **Frontend**: Vite dev server (`npm run dev:web`)
- **State**: In-memory storage

## Deployment Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Upstash Redis (for production)
1. Go to [Upstash Console](https://console.upstash.com)
2. Create a new Redis database
3. Copy the REST URL and Token

### 3. Configure Environment Variables in Vercel
In your Vercel project dashboard, add these environment variables:
```
UPSTASH_REDIS_REST_URL=https://xxx-xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXxxxxxx
NODE_ENV=production
```

### 4. Deploy to Vercel
```bash
# Option 1: Using Vercel CLI
npx vercel --prod

# Option 2: Connect GitHub repo to Vercel dashboard
# Push to main branch - auto-deploys
```

## Local Development

### Start both server and frontend:
```bash
npm run dev
```

### Or start individually:
```bash
# Terminal 1: Start backend server (WebSocket)
npm run dev:server

# Terminal 2: Start frontend (Vite)
npm run dev:web
```

### Test local server:
```bash
curl http://localhost:4000/api/health
```

## Environment Detection

The client automatically detects the environment:
- **Local development**: Uses WebSocket connection (`ws://localhost:4000/ws`)
- **Production/Vercel**: Uses Server-Sent Events (`/api/stream`)

## Session Management

### Local Development
- Uses in-memory storage
- Sessions reset on server restart

### Production/Vercel
- Uses Upstash Redis for session persistence
- Sessions expire after 1 hour
- Session ID stored in browser localStorage

## API Endpoints

All endpoints support session-based operation via `X-Session-Id` header:

- `GET /api/health` - Chain connectivity check
- `GET /api/accounts` - Get current account state
- `POST /api/setup` - Generate accounts and fund via faucet
- `POST /api/balance` - Check account balances
- `POST /api/send` - Send payment
- `POST /api/send-sponsored` - Send sponsored payment
- `POST /api/batch` - Batch payments
- `POST /api/history` - View transaction history
- `GET /api/stream` - Server-Sent Events stream (Vercel only)

## Troubleshooting

### Local Development Issues
1. **WebSocket connection fails**: Check if port 4000 is available
2. **Frontend can't connect**: Ensure both servers are running

### Vercel Deployment Issues
1. **Session not persisting**: Check Upstash Redis configuration
2. **API routes failing**: Check function logs in Vercel dashboard
3. **SSE connection issues**: Check browser network tab for stream endpoint

### Environment Variables
- Local development works without Redis (falls back to memory)
- Production requires Upstash Redis for session persistence
- Missing env vars will log warnings but use fallback storage

## Architecture Differences

| Feature | Local Development | Vercel Production |
|---------|------------------|-------------------|
| Real-time | WebSocket | Server-Sent Events |
| Storage | In-memory | Upstash Redis |
| Sessions | Process-scoped | Persistent |
| Deployment | Single server | Serverless functions |

## Files Added/Modified for Vercel

### New Files:
- `/api/` - Vercel API routes
- `/api/_lib/` - Shared utilities for session management
- `/api/_actions/` - Vercel-compatible action handlers
- `vercel.json` - Vercel configuration
- `VERCEL_DEPLOYMENT.md` - This deployment guide

### Modified Files:
- `package.json` - Added Vercel dependencies
- `web/hooks/useWebSocket.ts` - Environment detection and SSE support
- `web/components/ActionPanel.tsx` - Session ID in API calls

The refactoring maintains full backward compatibility with local development while enabling Vercel deployment.