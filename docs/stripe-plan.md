# Stripe + Distribution Plan

This document tracks the full launch sequence for accepting payments on ArbInq
and delivering SimpleSight automatically.

Work through the phases in order. Phases 1 and 2 are fully implemented in code —
they just need secrets and infrastructure provisioned.

---

## Phase 0 — Manual Fulfillment (emergency fallback)

If the automated system is down, you can still sell manually:
1. Use a Stripe Payment Link from the Dashboard.
2. After payment, email the customer a download link manually.

---

## Phase 1 + 2 — Automated Checkout + Delivery (IMPLEMENTED)

The full purchase-to-download flow is coded. These are the one-time provisioning
steps to activate it.

### 1. Provision Cloudflare D1 (purchase database)

```bash
cd worker
npx wrangler d1 create arbinq-purchases
```

Copy the `database_id` from the output into `worker/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "arbinq-purchases"
database_id = "PASTE_ID_HERE"
```

Apply the schema:
```bash
npx wrangler d1 execute arbinq-purchases --file=schema.sql
```

### 2. Provision Cloudflare R2 (software file storage)

```bash
npx wrangler r2 bucket create arbinq-software
```

Upload the SimpleSight zip:
```bash
npx wrangler r2 object put arbinq-software/simplesight/simplesight-latest.zip \
  --file=/path/to/simplesight-latest.zip
```

**To update the software file**, just re-upload with the same key. All future
download links automatically point to the new file.

### 3. Create the Stripe product and price

In Stripe Dashboard → Products:
- Name: `SimpleSight Device Inventory`
- Price: `$20.00` one-time
- Copy the **Price ID** (`price_...`)

### 4. Set Worker secrets

```bash
cd worker

# Stripe
npx wrangler secret put STRIPE_SECRET_KEY          # sk_live_...
npx wrangler secret put STRIPE_WEBHOOK_SECRET      # whsec_... (set after step 5)
npx wrangler secret put SIMPLESIGHT_PRICE_ID       # price_...

# Fastmail
npx wrangler secret put FASTMAIL_API_TOKEN         # from fastmail.com → Settings → Privacy & Security → API tokens
npx wrangler secret put FASTMAIL_ACCOUNT_ID        # see below
npx wrangler secret put FASTMAIL_SENT_MAILBOX_ID   # see below
npx wrangler secret put FASTMAIL_FROM_EMAIL        # e.g. sales@arbinquiry.com

# Site config
npx wrangler secret put SITE_URL                   # https://arbinquiry.com
npx wrangler secret put WORKER_URL                 # https://arbinq-api.<account>.workers.dev
```

**Getting FASTMAIL_ACCOUNT_ID:**
```bash
TOKEN="your_fastmail_api_token"
curl -s -H "Authorization: Bearer $TOKEN" https://api.fastmail.com/jmap/session \
  | jq -r '.primaryAccounts["urn:ietf:params:jmap:mail"]'
```

**Getting FASTMAIL_SENT_MAILBOX_ID:**
```bash
ACCOUNT_ID="u..."   # from above
curl -s -X POST https://api.fastmail.com/jmap/api/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"using\": [\"urn:ietf:params:jmap:core\",\"urn:ietf:params:jmap:mail\"],
    \"methodCalls\": [[\"Mailbox/get\",{\"accountId\":\"$ACCOUNT_ID\",\"ids\":null},\"m1\"]]
  }" | jq -r '.methodResponses[0][1].list[] | select(.role=="sent") | .id'
```

### 5. Deploy the Worker

```bash
cd worker
npx wrangler deploy
```

### 6. Register the Stripe webhook

In Stripe Dashboard → Webhooks → Add endpoint:
- URL: `https://arbinq-api.<account>.workers.dev/api/webhooks/stripe`
- Events: `checkout.session.completed`

Copy the **Signing Secret** (`whsec_...`) and set it:
```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 7. Update the site API URL

In `src/js/config.js`, replace the placeholder:
```js
window.ARBINQ_CONFIG = {
  apiBase: "https://arbinq-api.<account>.workers.dev",
};
```

Rebuild and deploy the site.

### 8. Test end-to-end in test mode

1. Set `STRIPE_SECRET_KEY` to your `sk_test_...` key first.
2. Use a Stripe test card (4242 4242 4242 4242) on the site.
3. Confirm: webhook fires → purchase row in D1 → email received → download works.
4. Swap to `sk_live_...` and the live price ID when confirmed.

---

## Purchase + Customer Database Schema

```sql
-- customers: one row per unique buyer, keyed on SHA-256(lower(email)).
-- When an account system is added, match users to existing purchases by hashing
-- their login email and looking up customers.email_hash.
customers (email_hash PK, created_at)

-- purchases: one row per Stripe Checkout Session completed.
purchases (id PK, customer_hash FK, email, product_id, amount, icp_slug, created_at)

-- download_tokens: UUID-based download links, 72hr expiry, 5 download cap.
download_tokens (token PK, purchase_id FK, product_id, email, expires_at, download_count, max_downloads)
```

---

## Phase 3 — User Accounts (future)

When an account system is added (Clerk recommended):

1. At registration/login, compute `SHA-256(lower(user.email))`.
2. Look up `customers.email_hash` — if found, link existing purchases to the new account.
3. Add `clerk_user_id TEXT` column to `customers` and set it at link time.
4. Build a `/dashboard` page showing past purchases and re-download options.

Customers who bought before accounts existed are automatically grandfathered in.

---

## Worker API Routes

| Method | Path                    | Description                                      |
|--------|-------------------------|--------------------------------------------------|
| POST   | /api/checkout           | Create Stripe Checkout Session, return URL       |
| POST   | /api/webhooks/stripe    | Handle payment events, send delivery email       |
| GET    | /api/download?token=... | Validate token, stream file from R2              |
| GET    | /api/health             | Health check                                     |
| GET    | /auth                   | GitHub OAuth for Decap CMS                       |
| GET    | /callback               | GitHub OAuth callback                            |

---

## Environment Variables Reference

| Variable                  | Set via         | Description                                       |
|---------------------------|-----------------|---------------------------------------------------|
| `GITHUB_CLIENT_ID`        | wrangler secret | GitHub OAuth app client ID (Decap CMS)            |
| `GITHUB_CLIENT_SECRET`    | wrangler secret | GitHub OAuth app client secret (Decap CMS)        |
| `STRIPE_SECRET_KEY`       | wrangler secret | `sk_live_...` (or `sk_test_...`)                  |
| `STRIPE_WEBHOOK_SECRET`   | wrangler secret | `whsec_...` from Stripe → Webhooks                |
| `SIMPLESIGHT_PRICE_ID`    | wrangler secret | `price_...` from Stripe → Products                |
| `FASTMAIL_API_TOKEN`      | wrangler secret | Fastmail API token                                |
| `FASTMAIL_ACCOUNT_ID`     | wrangler secret | JMAP account ID (see setup steps)                 |
| `FASTMAIL_SENT_MAILBOX_ID`| wrangler secret | JMAP mailbox ID for Sent folder                   |
| `FASTMAIL_FROM_EMAIL`     | wrangler secret | From address for delivery emails                  |
| `SITE_URL`                | wrangler secret | `https://arbinquiry.com`                          |
| `WORKER_URL`              | wrangler secret | Worker public URL (used in download links)        |
| `DB`                      | wrangler.toml   | D1 database binding                               |
| `SOFTWARE`                | wrangler.toml   | R2 bucket binding                                 |

---

## Go-Live Checklist

- [ ] D1 database created and schema applied
- [ ] R2 bucket created and SimpleSight zip uploaded
- [ ] Stripe account verified with bank account
- [ ] Stripe product + price created
- [ ] Worker deployed with all secrets set
- [ ] Stripe webhook registered (live mode)
- [ ] End-to-end test with test card confirmed
- [ ] Secrets swapped from test → live mode
- [ ] `apiBase` in `src/js/config.js` updated and site redeployed
- [ ] Real $1 smoke test purchase (then refund)
