# Tenant Deployment Guide

This guide explains how to deploy a new tenant for the School App system.

## Architecture

Each tenant gets their own isolated deployment:
- **Google Sheet**: Database for the tenant
- **Apps Script**: Backend API connected to the sheet
- **Cloudflare Worker**: Proxy + caching layer
- **Cloudflare Pages**: Static frontend

## Prerequisites

1. Google Account (for Sheets + Apps Script)
2. Cloudflare Account (for Pages + Workers)
3. Node.js installed
4. Install required tools:
   ```bash
   npm install -g wrangler
   npm install -g @google/clasp
   ```

---

## Step 1: Create Tenant Folder

Run the create-tenant script with your desired tenant name:

```bash
cd school-app
node scripts/create-tenant.js <tenant-name>
```

Example:
```bash
node scripts/create-tenant.js springfield-high
```

This creates `tenants/springfield-high/` with all config files.

---

## Step 2: Create Google Sheet + Apps Script

1. Create a new Google Sheet
2. Go to **Extensions** > **Apps Script**
3. Create a new project
4. Note: You don't need to copy files manually - the deploy script will do this

---

## Step 3: Update Script ID

1. Get your Apps Script ID from the URL:
   - URL: `https://script.google.com/macros/s/ABCD12345/exec`
   - Script ID: `ABCD12345`
2. Open `tenants/<tenant>/apps-script/SCRIPT_ID.txt`
3. Replace the content with your Apps Script ID
4. Save the file

---

## Step 4: Deploy Apps Script (First Run)

```bash
node scripts/deploy-apps-script.js <tenant-name>
```

Example:
```bash
node scripts/deploy-apps-script.js springfield-high
```

This will:
- Sync template files to tenant folder
- Push files to Apps Script via clasp
- Prompt you to deploy manually in browser

### Manual Deployment in Browser

1. Go to: `https://script.google.com/home/projects/YOUR_SCRIPT_ID`
2. Click **Deploy** > **New deployment**
3. Select type: **Web app**
4. Configure:
   - Description: Production
   - Execute as: Me
   - Who has access: **Anyone**
5. Click **Deploy**
6. Copy the **Web App URL** (e.g., `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`)
7. Save it to `tenants/<tenant>/apps-script/WEB_APP_URL.txt`

---

## Step 5: Deploy Apps Script (Second Run)

Run the script again to initialize sheets:

```bash
node scripts/deploy-apps-script.js <tenant-name>
```

This will:
- Read the Web App URL from `WEB_APP_URL.txt`
- Initialize the Google Sheet with required tabs (config, users, sessions, roles)

---

## Step 6: Deploy Worker

```bash
node scripts/deploy-worker.js <tenant-name>
```

This will:
- Read the Web App URL from `WEB_APP_URL.txt`
- Update `wrangler.toml` with SCRIPT_URL
- Deploy the Cloudflare Worker
- Update `public/js/config.js` with the Worker URL

---

## Step 7: Deploy Pages

```bash
node scripts/deploy-pages.js <tenant-name>
```

This will deploy the static frontend to Cloudflare Pages.

---

## Configuration Files

### Worker Config (`tenants/<tenant>/worker/wrangler.toml`)

| Variable | Description |
|----------|-------------|
| TENANT_ID | Unique tenant identifier |
| SCRIPT_URL | Apps Script Web App URL |
| SESSION_TIMEOUT_MINUTES | Session expiry time (default: 30) |
| RATE_LIMIT_PER_MINUTE | API rate limit (default: 60) |
| CACHE_TTL_SECONDS | Cache duration (default: 300) |
| ENABLE_RATE_LIMIT | Enable rate limiting (default: false) |

### Pages Config (`tenants/<tenant>/public/js/config.js`)

| Variable | Description |
|----------|-------------|
| TENANT_ID | Unique tenant identifier |
| API_URL | Worker URL |
| APP_NAME | Display name (default: "My School") |
| THEME_PRIMARY_COLOR | Primary brand color (default: "#2563eb") |
| THEME_SECONDARY_COLOR | Secondary brand color (default: "#1e40af") |
| LOGO_URL | Logo image URL |
| ALLOW_REGISTRATION | Allow user registration (default: true) |

### Apps Script Config (`tenants/<tenant>/apps-script/config.gs`)

| Variable | Description |
|----------|-------------|
| TENANT_ID | Unique tenant identifier |
| APP_NAME | Display name |
| ALLOW_REGISTRATION | Allow user registration |
| DEFAULT_ROLE | Default role for new users (default: "student") |
| SESSION_TIMEOUT_MINUTES | Session expiry time |

---

## Folder Structure

```
school-app/
├── scripts/
│   ├── create-tenant.js          # Creates tenant folder
│   ├── deploy-apps-script.js    # Deploys Apps Script + initializes sheets
│   ├── deploy-worker.js         # Deploys Worker
│   ├── deploy-pages.js          # Deploys Pages
│   └── utils.js                 # Shared utilities
├── template/                     # Base templates
├── tenants/                      # Tenant deployments
│   └── <tenant>/
│       ├── worker/
│       │   ├── wrangler.toml
│       │   └── src/
│       ├── public/
│       │   ├── index.html
│       │   ├── app.html
│       │   └── js/
│       │       ├── config.js
│       │       ├── api.js
│       │       └── auth.js
│       └── apps-script/
│           ├── Code.gs
│           ├── config.gs
│           ├── SCRIPT_ID.txt        # Your Apps Script ID
│           └── WEB_APP_URL.txt      # Web App URL (after deployment)
└── TENANT_DEPLOY_GUIDE.md
```

---

## Troubleshooting

### Apps Script deployment fails
- Make sure `clasp` is logged in: `clasp login`
- Check Apps Script ID is correct in `SCRIPT_ID.txt`

### Worker deployment fails
- Make sure `WEB_APP_URL.txt` has the Web App URL
- Run `wrangler login` first

### Pages deployment fails
- Make sure Worker was deployed successfully
- Run `wrangler login` first

### Sheet not found
- Run `deploy-apps-script.js` again - it will auto-initialize sheets

---

## Quick Commands Summary

```bash
# 1. Create new tenant
node scripts/create-tenant.js my-school

# 2. Add Script ID to SCRIPT_ID.txt

# 3. First deploy (pushes files, prompts for manual deployment)
node scripts/deploy-apps-script.js my-school

# 4. Deploy as Web App in browser, save URL to WEB_APP_URL.txt

# 5. Second deploy (initializes sheets)
node scripts/deploy-apps-script.js my-school

# 6. Deploy Worker
node scripts/deploy-worker.js my-school

# 7. Deploy Pages
node scripts/deploy-pages.js my-school
```
