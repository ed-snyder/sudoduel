# Hosting Privacy Policy & Terms of Service

## Option B: Traditional Hosting (cPanel, FTP, etc.)

### Step 1: Upload Files

Upload the HTML files to your web root directory (usually `public_html/` or `www/`):

```
/public_html/
  privacy.html
  terms.html
```

### Step 2: Set Up Clean URLs (Choose One Method)

#### Method 1: Create Folders (Recommended - Works Everywhere)

Create folders and move files:

```
/public_html/
  /privacy/
    index.html  (copy content from privacy.html)
  /terms/
    index.html  (copy content from terms.html)
```

This makes them accessible at:
- `sudoduel.com/privacy`
- `sudoduel.com/terms`

#### Method 2: Use .htaccess Rewrite Rules (Apache Servers)

If your server uses Apache, create or edit `.htaccess` in your web root:

```apache
RewriteEngine On

# Privacy Policy
RewriteRule ^privacy$ /privacy.html [L]

# Terms of Service
RewriteRule ^terms$ /terms.html [L]
```

**Note:** Make sure your server has `mod_rewrite` enabled.

#### Method 3: Direct Access (Simplest)

Just upload the files and access them directly:
- `sudoduel.com/privacy.html`
- `sudoduel.com/terms.html`

Then update the links in `SettingsModal.tsx` to include `.html`:
```tsx
href="https://sudoduel.com/privacy.html"
href="https://sudoduel.com/terms.html"
```

### Step 3: Test URLs

After uploading, test in your browser:
- `https://sudoduel.com/privacy` (or `/privacy.html`)
- `https://sudoduel.com/terms` (or `/terms.html`)

### Step 4: Verify Links in App

The links in the Settings modal should now work when tapped.

---

## Quick Reference

**Files to upload:**
- `web-client/public/privacy.html` → upload to web root
- `web-client/public/terms.html` → upload to web root

**URLs for App Store Connect:**
- Privacy Policy: `https://sudoduel.com/privacy` (or `/privacy.html`)
- Support: `mailto:support@sudoduel.com` or `https://sudoduel.com/support`
