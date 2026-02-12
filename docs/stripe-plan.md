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
