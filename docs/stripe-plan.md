# Stripe Integration Plan

This document tracks the full launch sequence for accepting payments on ArbInq.
Work through the phases in order. Each phase is independently shippable.

---

## Phase 0 — Payment Links (now)

**Goal:** Accept real payments with zero backend code.

1. Create a Stripe account (if not already done).
2. In Stripe Dashboard → Products, create a product:
   - Name: `SimpleSight Device Inventory`
   - Price: `$20.00` one-time
3. Create a Payment Link for that price.
4. Copy the Payment Link URL and paste it into `src/_data/products.yaml`:
   ```yaml
   simplesight:
     buy_href: "https://buy.stripe.com/your-link-id"
   ```
5. Rebuild and deploy. Every "Buy Now" button on the site now goes to Stripe.

**What you get:** Real customers can pay immediately. No webhook, no backend, no
session management. Stripe emails a receipt; you get notified of each sale.

**Limitation:** No custom metadata (UTM source, ICP slug), no discount codes,
no post-purchase redirect to a download page.

---

## Phase 1 — Checkout Sessions (Worker)

**Goal:** Replace the Payment Link with a custom Stripe Checkout Session so you
control the full purchase flow.

### Steps

1. Set `STRIPE_SECRET_KEY` on the Worker:
   ```bash
   cd worker && npx wrangler secret put STRIPE_SECRET_KEY
   ```
2. Copy the `stripe_price_id` from your Stripe product and set it in
   `src/_data/products.yaml`:
   ```yaml
   simplesight:
     stripe_price_id: "price_xxxxxxxxxxxxxxxxxxxxxxxx"
   ```
3. Implement `POST /api/checkout` in `worker/src/index.js`:
   - Accept `{ price_id, success_url, cancel_url, metadata }` in the request body.
   - Call `stripe.checkout.sessions.create(...)`.
   - Return `{ url }` — the frontend redirects to it.
4. Update the "Buy Now" buttons to `POST /api/checkout` instead of a direct link
   (or keep `buy_href` as a fallback for no-JS environments).

### Enables
- UTM tracking via `metadata`
- ICP slug attribution (pass `icp_slug` in metadata)
- Discount codes / promotion codes
- Custom success/cancel redirect URLs

---

## Phase 2 — Webhooks

**Goal:** Know when a purchase completes so you can fulfill it (send license key,
grant download access, log the sale).

### Steps

1. Set `STRIPE_WEBHOOK_SECRET` on the Worker:
   ```bash
   cd worker && npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
2. In Stripe Dashboard → Webhooks, register:
   - URL: `https://arbinq-api.<subdomain>.workers.dev/api/webhooks/stripe`
   - Events: `checkout.session.completed`
3. Implement `POST /api/webhooks/stripe` in `worker/src/index.js`:
   - Verify the Stripe signature using `STRIPE_WEBHOOK_SECRET`.
   - On `checkout.session.completed`, extract customer email, amount, metadata.
   - Write a purchase record to Cloudflare D1 (create a `purchases` table).
   - Trigger fulfillment: email a download link or license key.

### D1 schema (starter)

```sql
CREATE TABLE purchases (
  id          TEXT PRIMARY KEY,   -- Stripe session ID
  email       TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  amount      INTEGER NOT NULL,   -- cents
  icp_slug    TEXT,
  created_at  TEXT NOT NULL       -- ISO 8601
);
```

Add D1 binding to `worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "arbinq-purchases"
database_id = ""   # fill in after: wrangler d1 create arbinq-purchases
```

---

## Phase 2A — Download Distribution

**Goal:** Automatically deliver SimpleSight installer files to customers via email with secure, time-limited download links.

### Architecture

SimpleSight is a self-hosted software product with two installer files:
- `SimpleSightServerInstaller.exe` (~130MB)
- `SimpleSightInstaller.exe` (~20-25MB agent)

Files stored in private Cloudflare R2 bucket, delivered via presigned URLs.

### Steps

1. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create arbinq-downloads
   ```

2. **Upload installers to R2:**
   - Manually upload files to `simplesight/server/` and `simplesight/agent/` paths
   - Bucket remains private (no public access)

3. **Create R2 API token:**
   - Generate in Cloudflare dashboard with read permissions
   - Set as Worker secrets:
     ```bash
     wrangler secret put R2_ACCESS_KEY_ID
     wrangler secret put R2_SECRET_ACCESS_KEY
     wrangler secret put R2_ACCOUNT_ID  # Your Cloudflare account ID
     ```

4. **Set up Resend for email delivery:**
   - Create account at resend.com (free tier: 3,000 emails/month)
   - Add and verify sending domain
   - Configure SPF/DKIM DNS records
   - Generate API key and set secret:
     ```bash
     wrangler secret put RESEND_API_KEY
     ```

5. **Set admin API key for manual resend:**
   ```bash
   openssl rand -hex 32
   wrangler secret put ADMIN_API_KEY
   ```

6. **Run D1 migrations:**
   ```bash
   wrangler d1 execute arbinq-purchases --file=schema.sql
   ```

7. **Update wrangler.toml with R2 and D1 bindings** (already done in implementation)

### Database Schema

Extended `purchases` table:
```sql
CREATE TABLE purchases (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  amount      INTEGER NOT NULL,
  icp_slug    TEXT,
  created_at  TEXT NOT NULL,
  download_urls_sent_at TEXT      -- NEW: timestamp of email delivery
);
```

New `downloads` table:
```sql
CREATE TABLE downloads (
  id          TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  file_key    TEXT NOT NULL,      -- "server" or "agent"
  ip_address  TEXT,
  user_agent  TEXT,
  downloaded_at TEXT NOT NULL,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id)
);
```

### Customer Flow

1. Customer completes Stripe checkout
2. Webhook fires → Worker handles `checkout.session.completed`
3. Worker stores purchase in D1
4. Worker sends email via Resend with download links:
   - `https://arbinq-api.workers.dev/api/download/{purchase_id}/server`
   - `https://arbinq-api.workers.dev/api/download/{purchase_id}/agent`
5. Customer clicks link → Worker:
   - Verifies purchase exists and is within 30-day download window
   - Logs download event to D1
   - Generates 15-minute presigned R2 URL
   - Redirects customer to R2 for direct download
6. Customer downloads file directly from R2

### Security Model

- Files never publicly accessible (private R2 bucket)
- Download tracking URLs tied to purchase ID (not guessable)
- Presigned URLs expire after 15 minutes (regenerated on each click)
- 30-day download window per purchase
- All downloads logged with IP/user-agent for abuse detection

### Admin API

To manually resend download links (e.g., customer lost email):

```bash
curl -X POST https://arbinq-api.<subdomain>.workers.dev/api/admin/resend-download-links \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"purchase_id": "cs_live_..."}'
```

### Cost Analysis

Monthly operating costs (100 purchases/month):
- R2 storage: ~150MB = $0.01
- R2 operations: ~300 downloads = free (under 10M class B ops)
- Workers requests: ~300 = free (under 100k req)
- D1 reads/writes: ~600 = free (under 5M rows)
- Resend emails: 100 = free (under 3k/month)

**Total: ~$0.01/month** (effectively free)

Paid tier needed at 3,000+ purchases/month (Resend $20/month). At that scale, monthly revenue = $60,000.

---

## Phase 3 — User Accounts

**Goal:** Let customers log in, view their purchases, and manage licenses without
emailing you.

### Recommended approach: Clerk

1. Add Clerk to the frontend for authentication (email + social login).
2. On first purchase (`checkout.session.completed`), look up or create the Clerk
   user by email, then store `clerk_user_id` in the `purchases` table.
3. Add a `/dashboard` page (protected route) where users can:
   - See purchased products and download links.
   - Access the Stripe Customer Portal for receipts/invoices.

### Stripe Customer Portal

```js
// In Worker: POST /api/portal
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: "https://arbinquiry.com/dashboard",
});
return jsonResponse({ url: session.url });
```

---

## Environment Variables

| Variable                  | Phase | Description                                  |
|---------------------------|-------|----------------------------------------------|
| `GITHUB_CLIENT_ID`        | Now   | GitHub OAuth app client ID (Decap CMS)       |
| `GITHUB_CLIENT_SECRET`    | Now   | GitHub OAuth app client secret (Decap CMS)   |
| `STRIPE_SECRET_KEY`       | 1     | Stripe secret key (`sk_live_...`)            |
| `STRIPE_WEBHOOK_SECRET`   | 2     | Stripe webhook signing secret (`whsec_...`)  |
| `R2_ACCESS_KEY_ID`        | 2A    | R2 API token for presigned URL generation    |
| `R2_SECRET_ACCESS_KEY`    | 2A    | R2 API secret for presigned URL generation   |
| `R2_ACCOUNT_ID`           | 2A    | Cloudflare account ID for R2 endpoint        |
| `RESEND_API_KEY`          | 2A    | Resend.com API key for sending emails        |
| `ADMIN_API_KEY`           | 2A    | Secret key for manual download link resend   |
| `CLERK_SECRET_KEY`        | 3     | Clerk backend API key                        |

All set via:
```bash
cd worker && npx wrangler secret put VARIABLE_NAME
```

---

## Go-Live Checklist

- [ ] Stripe account created and verified
- [ ] Business name and bank account added to Stripe
- [ ] Test mode purchases confirmed end-to-end
- [ ] Swap `sk_test_...` → `sk_live_...` in Worker secrets
- [ ] Swap Stripe Payment Link / price ID to live mode equivalent
- [ ] Webhook registered in live mode dashboard
- [ ] Domain verified in Stripe (for Payment Links branding)
- [ ] `buy_href` in `products.yaml` updated to live Stripe URL
- [ ] Smoke test a real $1 purchase (then refund)
- [ ] Confirmation email / fulfillment tested
