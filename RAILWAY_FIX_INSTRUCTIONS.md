# Railway Build Fix - CRITICAL

## The Problem
Railway is trying to build from the repository root (`/`) instead of the backend directory (`/backend`). This causes Railpack to fail because there's no `package.json` at the root.

## The Solution

### Step 1: Set Root Directory in Railway Dashboard

**For Backend Service:**
1. Go to https://railway.app
2. Open your project
3. Click on your **Backend** service (not Postgres)
4. Go to **Settings** tab
5. Scroll down to **Root Directory**
6. Set it to: `backend` (without the leading slash)
7. Click **Save**

**For Frontend Service:**
1. Click on your **Frontend** service
2. Go to **Settings** tab
3. Set **Root Directory** to: `web-client`
4. Click **Save**

### Step 2: Verify railway.toml Files Exist

Both of these files should exist:
- `backend/railway.toml` ✅ (already exists)
- `web-client/railway.toml` ✅ (already exists)

### Step 3: Redeploy

After setting the root directory:
1. Go to **Deployments** tab
2. Click **Redeploy** or trigger a new deployment
3. The build should now work

## Why This Happens

Railway defaults to building from the repository root. Since this is a monorepo with multiple services, you need to tell Railway which directory contains each service.

## Alternative: Use Railway CLI

If you prefer CLI:

```bash
# Link to your project
railway link

# Set root directory for backend service
railway service --name "backend"  # Select backend service
railway variables set RAILWAY_ROOT_DIRECTORY=backend

# Redeploy
railway redeploy
```

## Verification

After fixing, you should see in the build logs:
- ✅ Building from `/backend` directory
- ✅ Found `package.json`
- ✅ Running `npm install && npm run build`
- ✅ Build succeeds
