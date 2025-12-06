# Railway Build Fix Guide

## Issue: "Error creating build plan with Railpack"

This error typically occurs when Railway can't detect the project type or the root directory isn't set correctly.

## Solution

### 1. Check Service Root Directory

In Railway dashboard:
1. Go to your backend service
2. Click on **Settings** tab
3. Scroll to **Root Directory**
4. Set it to: `/backend`
5. Save changes

### 2. Verify railway.toml

The `backend/railway.toml` file should exist with:
```toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

### 3. Verify package.json

Ensure `backend/package.json` exists and has:
- `build` script: `"build": "tsc"`
- `start` script: `"start": "node dist/index.js"`
- Node version: `"node": ">=20.0.0"`

### 4. Database Connection Error

If you see "Error in postgres db":
1. Check that `DATABASE_URL` environment variable is set in Railway
2. Verify the PostgreSQL service is running
3. Check database connection string format:
   ```
   postgresql://user:password@host:port/database
   ```

### 5. Manual Trigger

After fixing root directory:
1. Go to **Deployments** tab
2. Click **Redeploy** or trigger a new deployment
3. Monitor build logs for errors

## Alternative: Use Dockerfile

If Nixpacks continues to fail, you can create a `backend/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start"]
```

Then in Railway, set builder to "Dockerfile" instead of "nixpacks".
