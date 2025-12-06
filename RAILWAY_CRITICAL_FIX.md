# 🚨 CRITICAL: Railway Build Fix - Step by Step

## The Problem
Railway is scanning from repository root (`/`) instead of `/backend`, causing "Railpack could not determine how to build" error.

## ✅ THE FIX (Do This Exactly)

### Step 1: Verify Backend Service Exists
1. Go to https://railway.app
2. Open your project
3. **Check if you have a "Backend" service** (separate from "Postgres")
   - If NO backend service exists → Create one (see Step 2)
   - If YES → Go to Step 3

### Step 2: Create Backend Service (if missing)
1. Click **"+ New"** → **"GitHub Repo"**
2. Select your `sudoduel` repository
3. Railway will create a service
4. **IMPORTANT**: Before it starts building, go to Settings immediately

### Step 3: Set Root Directory (CRITICAL)
1. Click on your **Backend** service (NOT Postgres)
2. Go to **Settings** tab
3. Scroll to **"Root Directory"** section
4. **Clear any existing value**
5. Type exactly: `backend` (lowercase, no slash)
6. Click **"Save"** or press Enter
7. **Verify it saved** - refresh page and check it's still `backend`

### Step 4: Set Builder Type
1. Still in **Settings** tab
2. Find **"Builder"** or **"Build Command"** section
3. Set to: **"Dockerfile"** (if available) OR **"Nixpacks"**
4. If Dockerfile: Ensure it detects `backend/Dockerfile`
5. Save

### Step 5: Verify Files Exist
Check that these files exist in your repo:
- ✅ `backend/package.json`
- ✅ `backend/Dockerfile`
- ✅ `backend/railway.toml`
- ✅ `backend/src/index.ts`

### Step 6: Redeploy
1. Go to **Deployments** tab
2. Click **"Redeploy"** or **"Deploy"**
3. Watch the build logs

### Step 7: Check Build Logs
Look for:
- ✅ "Building from directory: backend"
- ✅ "Found Dockerfile" or "Detected Node.js"
- ✅ "npm install" running
- ✅ "npm run build" running
- ❌ If you see "Scanning root directory" → Root directory not set correctly

## 🔍 Verification Checklist

After setting root directory, the build logs should show:
```
[Railway] Building from: backend
[Railway] Found: backend/package.json
[Railway] Found: backend/Dockerfile (or Detected: Node.js)
[Railway] Running: npm install
```

If you still see:
```
[Railway] Scanning: ./
[Railway] Found: backend/, web-client/, database/
[Railway] Error: Could not determine build
```
→ **Root directory is NOT set correctly. Go back to Step 3.**

## 🆘 Still Not Working?

### Option A: Delete and Recreate Service
1. Delete the backend service in Railway
2. Create new service from GitHub repo
3. **IMMEDIATELY** set root directory to `backend` BEFORE first build
4. Then deploy

### Option B: Use Railway CLI
```bash
cd /Users/eric/sudoduel
railway link  # Link to your project
railway service  # Select backend service
railway variables set RAILWAY_ROOT_DIRECTORY=backend
railway redeploy
```

### Option C: Contact Railway Support
If root directory setting isn't working, this might be a Railway platform issue.

## 📝 What I've Added to the Repo

1. ✅ `backend/Dockerfile` - Explicit build steps
2. ✅ `backend/railway.toml` - Service config
3. ✅ `backend/nixpacks.toml` - Fallback config
4. ✅ `backend/.dockerignore` - Optimize builds
5. ✅ Root `railway.toml` - Monorepo detection
6. ✅ Root `package.json` - Help Railway understand structure

**But the root directory MUST be set in Railway dashboard for any of this to work.**

## 🎯 The Real Issue

Railway's auto-detection fails on monorepos. You **MUST** manually set the root directory in the dashboard. There's no way around this - it's a Railway limitation with monorepos.
