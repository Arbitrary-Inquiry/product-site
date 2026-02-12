# ArbInq API Worker

Cloudflare Worker serving GitHub OAuth (for Decap CMS) and future Stripe endpoints.

## Routes

| Method | Path                   | Description                          |
|--------|------------------------|--------------------------------------|
| GET    | /auth                  | GitHub OAuth init (Decap CMS)        |
| GET    | /callback              | GitHub OAuth callback (Decap CMS)    |
| GET    | /api/health            | Health check                         |
| POST   | /api/checkout          | Stripe Checkout Session (stub)       |
| POST   | /api/webhooks/stripe   | Stripe webhook handler (stub)        |

## Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Set secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Future secrets (set when Stripe is integrated):

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Update Decap CMS config

In `src/admin/config.yml`, set `base_url` to the deployed Worker URL:

```yaml
backend:
  name: github
  repo: your-org/your-repo
  base_url: https://arbinq-api.your-subdomain.workers.dev
```

## Local development

```bash
npm run dev
```

Note: OAuth routes require `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to be set
in a `.dev.vars` file (not committed) or as Wrangler secrets.
