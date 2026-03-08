# ArbInq API Worker

Cloudflare Worker serving:
- GitHub OAuth (for Decap CMS)
- Stripe webhooks and checkout
- SimpleSight software download distribution

## Routes

| Method | Path                               | Description                                |
|--------|------------------------------------|--------------------------------------------|
| GET    | /auth                              | GitHub OAuth init (Decap CMS)              |
| GET    | /callback                          | GitHub OAuth callback (Decap CMS)          |
| GET    | /api/health                        | Health check                               |
| POST   | /api/checkout                      | Stripe Checkout Session (stub)             |
| POST   | /api/webhooks/stripe               | Stripe webhook handler (live)              |
| GET    | /api/download/:purchase_id/server  | SimpleSight server installer download      |
| GET    | /api/download/:purchase_id/agent   | SimpleSight agent installer download       |
| POST   | /api/admin/resend-download-links   | Admin: resend download email               |

## Architecture

### SimpleSight Download Distribution

SimpleSight Device Inventory is a $20 one-time purchase self-hosted software. After payment:

1. **Stripe checkout completes** → webhook fires
2. **Worker receives webhook** → verifies signature, stores purchase in D1
3. **Worker sends email** via Resend with download links
4. **Customer clicks link** → Worker generates 15-min presigned R2 URL
5. **Customer downloads** directly from private R2 bucket

**Security:**
- Files stored in private R2 bucket (not publicly accessible)
- Download links tied to purchase ID (not guessable)
- Presigned URLs expire after 15 minutes
- 30-day download window per purchase
- All downloads logged with IP/user-agent

**Files delivered:**
- `SimpleSightServerInstaller.exe` (~130MB)
- `SimpleSightInstaller.exe` (~20-25MB agent)

## Setup

### 1. Install dependencies

```bash
cd worker
npm install
```

### 2. Create R2 bucket

```bash
wrangler r2 bucket create arbinq-downloads
```

Upload SimpleSight installers to:
- `simplesight/server/SimpleSightServerInstaller.exe`
- `simplesight/agent/SimpleSightInstaller.exe`

### 3. Create D1 database

```bash
wrangler d1 create arbinq-purchases
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "arbinq-purchases"
database_id = "YOUR_DATABASE_ID_HERE"
```

Run the schema migration:

```bash
wrangler d1 execute arbinq-purchases --file=schema.sql
```

### 4. Set secrets

**OAuth (existing):**
```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

**Stripe:**
```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

**Download distribution:**
```bash
# Generate R2 API token in Cloudflare dashboard
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put R2_ACCOUNT_ID

# Create Resend account, verify domain, get API key
wrangler secret put RESEND_API_KEY

# Generate random admin key
openssl rand -hex 32
wrangler secret put ADMIN_API_KEY
```

### 5. Configure Stripe webhook

In Stripe Dashboard → Webhooks:
- URL: `https://arbinq-api.<subdomain>.workers.dev/api/webhooks/stripe`
- Events: `checkout.session.completed`
- Copy webhook signing secret → set as `STRIPE_WEBHOOK_SECRET`

### 6. Deploy

```bash
npm run deploy
```

### 7. Update Decap CMS config

In `src/admin/config.yml`, set `base_url` to the deployed Worker URL:

```yaml
backend:
  name: github
  repo: your-org/your-repo
  base_url: https://arbinq-api.your-subdomain.workers.dev
```

## Admin Operations

### Manually resend download links

If a customer loses their download email:

```bash
curl -X POST https://arbinq-api.<subdomain>.workers.dev/api/admin/resend-download-links \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"purchase_id": "cs_live_a1b2c3d4..."}'
```

Response:
```json
{
  "success": true,
  "purchase_id": "cs_live_a1b2c3d4...",
  "email": "customer@example.com",
  "sent_at": "2026-02-25T12:34:56.789Z"
}
```

### Query purchases

```bash
# View recent purchases
wrangler d1 execute arbinq-purchases \
  --command "SELECT * FROM purchases ORDER BY created_at DESC LIMIT 10"

# View downloads for a purchase
wrangler d1 execute arbinq-purchases \
  --command "SELECT * FROM downloads WHERE purchase_id = 'cs_live_...'"

# Check email delivery status
wrangler d1 execute arbinq-purchases \
  --command "SELECT id, email, download_urls_sent_at FROM purchases WHERE download_urls_sent_at IS NOT NULL"
```

## Local Development

```bash
npm run dev
```

**Note:** OAuth and download routes require secrets to be set. For local testing:

1. Create `.dev.vars` file (not committed):
   ```env
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   STRIPE_WEBHOOK_SECRET=whsec_test_...
   RESEND_API_KEY=re_...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_ACCOUNT_ID=...
   ADMIN_API_KEY=test_admin_key
   ```

2. Use Stripe CLI to forward webhooks to local dev:
   ```bash
   stripe listen --forward-to http://localhost:8787/api/webhooks/stripe
   ```

3. Test download flow with test mode purchase

## Testing Checklist

### Stripe Test Mode

- [ ] Complete test checkout session
- [ ] Verify webhook fires and reaches Worker
- [ ] Check purchase record created in D1
- [ ] Confirm email arrives with correct links
- [ ] Click download link, verify redirect to R2 presigned URL
- [ ] Verify download event logged in D1

### Edge Cases

- [ ] Test expired download window (manually set old timestamp)
- [ ] Test invalid purchase_id (should 404)
- [ ] Test invalid file_type (should 400)
- [ ] Test admin resend API with correct key
- [ ] Test admin resend API with wrong key (should 401)
- [ ] Test webhook signature verification failure

### Production Verification

- [ ] Deploy Worker
- [ ] Upload installers to R2 production bucket
- [ ] Update Stripe webhook URL to production endpoint
- [ ] Set all production secrets
- [ ] Switch Stripe to live mode
- [ ] Test with real $1 purchase (refund after)
- [ ] Monitor Worker logs for first 24 hours

## Monitoring

View Worker logs:
```bash
wrangler tail
```

Check for errors in Cloudflare dashboard → Workers & Pages → arbinq-api → Logs

Set up error alerting (email on Worker exceptions) in Cloudflare dashboard.

## Cost Analysis

Monthly operating costs at 100 purchases/month:
- R2 storage: ~150MB = **$0.01**
- R2 operations: ~300 downloads = **free** (under 10M class B ops)
- Workers requests: ~300 = **free** (under 100k req)
- D1 reads/writes: ~600 = **free** (under 5M rows)
- Resend emails: 100 = **free** (under 3k/month)

**Total: ~$0.01/month** (effectively free until significant scale)

Paid tier needed at 3,000+ purchases/month → Resend paid tier ($20/month). At that scale, monthly revenue = $60,000 (infrastructure cost = 0.03% of revenue).

## Troubleshooting

### Email not sent

1. Check Resend dashboard for delivery status
2. Verify SPF/DKIM records are configured
3. Check Worker logs for errors: `wrangler tail`
4. Verify `RESEND_API_KEY` is set correctly

### Download link returns 404

1. Verify purchase exists in D1:
   ```bash
   wrangler d1 execute arbinq-purchases \
     --command "SELECT * FROM purchases WHERE id = 'cs_live_...'"
   ```
2. Check `download_urls_sent_at` timestamp (must be within 30 days)
3. Verify file exists in R2 bucket at correct path

### Presigned URL generation fails

1. Verify R2 secrets are set:
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_ACCOUNT_ID`
2. Check R2 API token has read permissions
3. Verify bucket name is `arbinq-downloads`

### Webhook signature verification fails

1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Check timestamp is recent (5-minute tolerance)
3. Test with Stripe CLI: `stripe trigger checkout.session.completed`

## Further Reading

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Resend API Docs](https://resend.com/docs/api-reference/emails/send-email)
- [Stripe Webhooks](https://docs.stripe.com/webhooks)
- [Workers D1 Database](https://developers.cloudflare.com/d1/)
