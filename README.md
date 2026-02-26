# School App - Role Based Authentication System

A multi-tenant role-based authentication system using Google Sheets as database, Google App Script as backend, and Cloudflare Worker + Pages for hosting.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │     │  Cloudflare      │     │  Google Sheets  │
│  Pages (UI)     │────▶│  Worker (Proxy   │────▶│  + App Script   │
│                 │     │  + Cache)        │     │  (Database)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

Each tenant gets isolated deployment with separate:
- Google Sheet database
- Apps Script backend
- Cloudflare Worker
- Cloudflare Pages site

## Tech Stack

- **Database**: Google Sheets
- **Backend**: Google App Script
- **Caching**: Cloudflare Worker + Cache API
- **Frontend**: Static HTML/JS (Cloudflare Pages)

---

## Prerequisites

1. Google Account (for Sheets + App Script)
2. Cloudflare Account (for Pages + Workers)
3. Node.js installed

Install required tools:
```bash
npm install -g wrangler
npm install -g @google/clasp
```

Install project dependencies:
```bash
npm install
```

Login to both:
```bash
wrangler login
clasp login
```

---

## Configuration

All configuration is centralized in `config.yaml`. Edit this file to customize:

| Section | Description |
|---------|-------------|
| `project.namePrefix` | Prefix for Worker/App names (e.g., "school" → "school-worker-{tenant}") |
| `defaults.appName` | Default app display name |
| `defaults.theme` | Theme colors (primary, secondary, accent, background, text) |
| `defaults.defaultRole` | Default role for new users |
| `defaults.sessionTimeoutMinutes` | Session expiry time |
| `defaults.rateLimitPerMinute` | API rate limit |
| `defaults.allowRegistration` | Allow new user registrations |
| `cache` | Cache TTL per resource type |

---

## Quick Start (Multi-Tenant)

```bash
# 1. Create new tenant
node scripts/create-tenant.js my-school

# 2. Add Script ID to tenants/my-school/apps-script/SCRIPT_ID.txt
#    Get from: https://script.google.com/home/users/YOUR_EMAIL/projects

# 3. First deploy (pushes files, prompts for manual deployment)
node scripts/deploy-apps-script.js my-school

# 4. Deploy as Web App in browser:
#    - Go to: https://script.google.com/home/projects/YOUR_SCRIPT_ID
#    - Deploy > New deployment > Web app
#    - Execute as: Me, Who has access: Anyone
#    - Copy Web App URL
#    - Save to: tenants/my-school/apps-script/WEB_APP_URL.txt

# 5. Second deploy (initializes sheets, sets SCRIPT_URL)
node scripts/deploy-apps-script.js my-school

# 6. Deploy Worker
node scripts/deploy-worker.js my-school

# 7. Deploy Pages
node scripts/deploy-pages.js my-school
```

---

## Deployment Scripts

| Script | Description |
|--------|-------------|
| `create-tenant.js` | Creates tenant folder from template |
| `deploy-apps-script.js` | Pushes files to Apps Script, initializes sheets |
| `deploy-worker.js` | Deploys Cloudflare Worker |
| `deploy-pages.js` | Deploys Cloudflare Pages |

---

## Manual Setup (Single Tenant)

### Step 1: Create Google Sheet

Create a new Google Sheet with these sheets:
- `config` - App configuration
- `users` - User records
- `sessions` - Session tokens
- `roles` - Role permissions

### Step 2: Create Google App Script

1. In your Google Sheet: **Extensions** > **Apps Script**
2. Copy code from `apps-script/Code.gs`
3. **Deploy** > **New deployment** > **Web app**
4. Configure: Execute as Me, Who has access: Anyone
5. Copy the Web App URL

### Step 3: Configure Worker

1. Update `worker/wrangler.toml`:
   - Set `SCRIPT_URL` to your Web App URL
   - Set `TENANT_ID` to your tenant name
2. Deploy: `cd worker && wrangler deploy`

### Step 4: Deploy Frontend

1. Update `public/js/config.js` with your Worker URL
2. Deploy: `wrangler pages deploy public`

---

## API Endpoints

### Registration
```
POST /api/register
Body: { "email": "...", "phone": "...", "password": "...", "name": "...", "role": "student" }
```

### Login
```
POST /api/login
Body: { "email": "...", "password": "..." }
Response: { "token": "...", "user": { "id": "...", "name": "...", "role": "..." } }
```

### Logout
```
POST /api/logout
Headers: { "Authorization": "Bearer <token>" }
```

### Verify Token
```
GET /api/verify
Headers: { "Authorization": "Bearer <token>" }
```

### Get Users (Admin only)
```
GET /api/users
Headers: { "Authorization": "Bearer <token>" }
```

---

## Role Permissions

| Role | Permissions |
|------|-------------|
| admin | * (all access) |
| teacher | read:students, write:grades |
| parent | read:own_child |
| student | read:own_grades |

---

## Caching Strategy

- **GET /api/users**: Cached for 5 minutes (configurable)
- **GET /api/verify**: No cache (always fresh)
- **POST /api/***: Never cached (always forward)

---

## Configuration

### Worker (wrangler.toml)
| Variable | Description | Default |
|----------|-------------|---------|
| TENANT_ID | Unique tenant identifier | - |
| SCRIPT_URL | Apps Script Web App URL | - |
| SESSION_TIMEOUT_MINUTES | Session expiry | 30 |
| RATE_LIMIT_PER_MINUTE | API rate limit | 60 |
| CACHE_TTL_SECONDS | Cache duration | 300 |
| ENABLE_RATE_LIMIT | Enable rate limiting | false |

### Frontend (public/js/config.js)
| Variable | Description | Default |
|----------|-------------|---------|
| TENANT_ID | Unique tenant identifier | - |
| API_URL | Worker URL | - |
| APP_NAME | Display name | "My School" |
| THEME_PRIMARY_COLOR | Primary color | "#2563eb" |
| THEME_SECONDARY_COLOR | Secondary color | "#1e40af" |
| ALLOW_REGISTRATION | Allow new users | true |

---

## File Structure

```
school-app/
├── scripts/
│   ├── create-tenant.js          # Create tenant folder from root source
│   ├── deploy-apps-script.js     # Deploy Apps Script
│   ├── deploy-worker.js          # Deploy Worker
│   ├── deploy-pages.js           # Deploy Pages
│   └── utils.js                 # Shared utilities
├── tenants/                      # Deployed tenants
│   └── <tenant>/
│       ├── worker/              # Tenant worker code
│       ├── public/              # Tenant static files
│       └── apps-script/         # Tenant Apps Script code
├── apps-script/                 # Source Apps Script (Template)
├── worker/                      # Source Worker (Template)
└── public/                      # Source Static files (Template)
```

---

## Development

### Local Development

```bash
# Worker
cd worker
wrangler dev

# Frontend
cd public
npx serve .
```

### Testing

```bash
# Register
curl -X POST https://your-worker.workers.dev/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test User","role":"student"}'

# Login
curl -X POST https://your-worker.workers.dev/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

---

## Security Notes

1. **Passwords**: Stored as SHA-256 hash
2. **Sessions**: Random UUID tokens with sliding expiration
3. **CORS**: Handled by Cloudflare Worker
4. **Rate Limiting**: Configurable in Worker

---

## License

MIT
