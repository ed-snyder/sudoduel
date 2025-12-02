# Railway Deployment Guide for Sudoduel

This document outlines the deployment configuration for Sudoduel on Railway.

## Production Domains

- **Frontend**: https://sudoduel.com
- **Backend API**: https://api.sudoduel.com
- **WebSocket**: wss://api.sudoduel.com

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET=your-secret-key-here

# Server
PORT=3001  # Railway will override this
NODE_ENV=production
```

### Frontend (Railway Environment Variables)

Set these in Railway dashboard for the frontend service:

```bash
VITE_API_URL=https://api.sudoduel.com
VITE_WS_URL=wss://api.sudoduel.com
```

## Deployment Steps

### 1. Backend Service

1. Connect your GitHub repo to Railway
2. Create a new service for the backend
3. Set root directory to `/backend`
4. Railway will automatically detect `railway.toml`
5. Add environment variables (see above)
6. Deploy

### 2. Frontend Service

1. Create a new service for the frontend
2. Set root directory to `/web-client`
3. Railway will automatically detect `railway.toml`
4. Add environment variables:
   - `VITE_API_URL=https://api.sudoduel.com`
   - `VITE_WS_URL=wss://api.sudoduel.com`
5. Deploy

### 3. Database

1. Create a PostgreSQL service in Railway
2. Copy the connection string to backend `DATABASE_URL`
3. Run migrations:
   ```bash
   # Connect to Railway database and run:
   psql $DATABASE_URL < database/migrations/001_initial_schema.sql
   ```

## Mobile App Store Readiness

The codebase is prepared for Capacitor deployment:

### Components Created

- `SafeAreaWrapper` - Handles safe area insets for notched devices
- `useMobileDetect` - Detects mobile/touch/iOS/Android/Capacitor
- `useHaptics` - Provides haptic feedback (web + Capacitor ready)

### Mobile Optimizations

- ✅ Safe area insets support
- ✅ Touch-friendly tap targets (44px minimum)
- ✅ Prevented zoom on input focus (16px font size)
- ✅ Pull-to-refresh prevention
- ✅ Dynamic viewport height (100dvh)
- ✅ Capacitor protocol support in CORS

### Future Capacitor Setup

When ready to build mobile apps:

1. Install Capacitor:
   ```bash
   cd web-client
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```

2. Add platforms:
   ```bash
   npx cap add ios
   npx cap add android
   ```

3. Build and sync:
   ```bash
   npm run build
   npx cap sync
   ```

## Verification Checklist

- [x] Backend builds successfully (`npm run build`)
- [x] Frontend builds successfully (`npm run build`)
- [x] No hardcoded localhost URLs remain
- [x] CORS configured for production domains
- [x] Health check endpoint at `/health`
- [x] Mobile-ready meta tags in `index.html`
- [x] Safe area support in CSS
- [x] WebSocket URL configuration

## Testing Locally

To test production configuration locally:

```bash
# Backend
cd backend
VITE_API_URL=https://api.sudoduel.com VITE_WS_URL=wss://api.sudoduel.com npm run dev

# Frontend
cd web-client
VITE_API_URL=http://localhost:3001 VITE_WS_URL=ws://localhost:3001 npm run dev
```

## Troubleshooting

### CORS Errors

If you see CORS errors, verify:
1. Backend `allowedOrigins` includes your frontend domain
2. Frontend `VITE_API_URL` matches backend domain
3. Credentials are enabled in CORS config

### WebSocket Connection Issues

1. Verify `VITE_WS_URL` uses `wss://` for production
2. Check Railway WebSocket support (should work automatically)
3. Ensure backend WebSocket path is `/ws/game`

### Build Failures

1. Check TypeScript errors: `npm run build`
2. Verify all dependencies are in `package.json`
3. Ensure `railway.toml` has correct build commands

