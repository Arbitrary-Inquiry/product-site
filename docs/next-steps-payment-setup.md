# Next Steps: Payment Processing Setup

This document tracks the remaining manual steps to complete the SimpleSight download distribution system.

## Status: In Progress

### ✅ Completed Steps

- [x] R2 bucket created (`arbinq-downloads`)
- [x] D1 database created and schema applied (`arbinq-purchases`)
- [x] Worker dependencies installed (`aws4fetch`)
- [x] Wrangler.toml configured with R2 and D1 bindings
- [x] Worker code implemented (webhooks, downloads, email)
- [x] R2 API token created
- [x] Admin API key generated: `85a8a543b89386a4ab7c649834277b5173c399eea0c9c2cb30add35ddcd43614`

### 🔄 Secrets Set (via wrangler secret put)

Run these commands from the `worker/` directory:

```bash
# R2 secrets (use your R2 API token values from dashboard)
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY

# Cloudflare Account ID
npx wrangler secret put R2_ACCOUNT_ID
# Value: 66b9b9f5a05cee221924d9876eb5159a

# Admin API key (for manual download link resend)
npx wrangler secret put ADMIN_API_KEY
# Value: 85a8a543b89386a4ab7c649834277b5173c399eea0c9c2cb30add35ddcd43614
```

### ⏳ Pending: Resend Email Setup

**Waiting on:** DNS provider access

1. **Sign up for Resend:**
   - Go to https://resend.com
   - Create account (free tier: 3,000 emails/month)

2. **Add domain:**
   - Click "Add Domain" in Resend dashboard
   - Enter: `arbinquiry.com`

3. **Configure DNS records:**
   Resend will provide SPF and DKIM TXT records. Add these to your DNS provider:

   ```
   Example records (actual values will be in Resend dashboard):

   TXT @ "v=spf1 include:_spf.resend.com ~all"
   TXT resend._domainkey.<random> "v=DKIM1; k=rsa; p=<public-key>"
   ```

4. **Verify domain:**
   - Wait 5-10 minutes for DNS propagation
   - Click "Verify" in Resend dashboard

5. **Generate API key:**
   - Go to "API Keys" in Resend dashboard
   - Create new key
   - Copy the key (starts with `re_...`)

6. **Set Worker secret:**
   ```bash
   npx wrangler secret put RESEND_API_KEY
   # Paste your Resend API key when prompted
   ```

### ⏳ Pending: Upload SimpleSight Installers to R2

Use Wrangler or the Cloudflare dashboard to upload the installer files:

**Via Wrangler CLI:**
```bash
# Upload server installer
npx wrangler r2 object put arbinq-downloads/simplesight/server/SimpleSightServerInstaller.exe \
  --file=/path/to/SimpleSightServerInstaller.exe

# Upload agent installer
npx wrangler r2 object put arbinq-downloads/simplesight/agent/SimpleSightInstaller.exe \
  --file=/path/to/SimpleSightInstaller.exe
```

**Via Cloudflare Dashboard:**
1. Go to https://dash.cloudflare.com → R2
2. Click on `arbinq-downloads` bucket
3. Create folder: `simplesight/server/`
4. Upload `SimpleSightServerInstaller.exe` to `server/` folder
5. Create folder: `simplesight/agent/`
6. Upload `SimpleSightInstaller.exe` to `agent/` folder

### ⏳ Pending: Stripe Webhook Configuration

1. **Get Worker URL** (after first deployment):
   ```bash
   npx wrangler deploy
   ```
   Note the URL (e.g., `https://arbinq-api.your-subdomain.workers.dev`)

2. **Register webhook in Stripe:**
   - Go to https://dashboard.stripe.com → Webhooks (or Developers → Webhooks)
   - Click "Add endpoint"
   - URL: `https://arbinq-api.your-subdomain.workers.dev/api/webhooks/stripe`
   - Events to listen: Select `checkout.session.completed`
   - Click "Add endpoint"

3. **Get webhook signing secret:**
   - Click on the newly created webhook
   - Copy the "Signing secret" (starts with `whsec_...`)

4. **Set Worker secret:**
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   # Paste the webhook signing secret when prompted
   ```

### ⏳ Pending: Deploy Worker

Once all secrets are set and installers are uploaded:

```bash
cd worker
npx wrangler deploy
```

This will deploy the Worker to production and give you the live URL.

---

## Testing Checklist

### Test Mode (Before Going Live)

- [ ] Complete a test Stripe checkout
- [ ] Verify webhook fires and reaches Worker (check Wrangler logs: `npx wrangler tail`)
- [ ] Confirm purchase record created in D1:
  ```bash
  npx wrangler d1 execute arbinq-purchases --remote \
    --command "SELECT * FROM purchases ORDER BY created_at DESC LIMIT 5"
  ```
- [ ] Verify email arrives with download links
- [ ] Click download link, verify redirect to R2 presigned URL
- [ ] Verify file downloads successfully
- [ ] Confirm download event logged in D1:
  ```bash
  npx wrangler d1 execute arbinq-purchases --remote \
    --command "SELECT * FROM downloads ORDER BY downloaded_at DESC LIMIT 5"
  ```

### Edge Cases

- [ ] Test expired download window (manually set old timestamp in D1)
- [ ] Test invalid purchase_id (should return 404)
- [ ] Test invalid file_type (should return 400)
- [ ] Test admin resend API:
  ```bash
  curl -X POST https://arbinq-api.workers.dev/api/admin/resend-download-links \
    -H "Authorization: Bearer 85a8a543b89386a4ab7c649834277b5173c399eea0c9c2cb30add35ddcd43614" \
    -H "Content-Type: application/json" \
    -d '{"purchase_id": "cs_test_..."}'
  ```
- [ ] Test webhook signature verification (send invalid signature, should fail)

### Production Verification

- [ ] All secrets set in production
- [ ] Installers uploaded to R2 production bucket
- [ ] Stripe webhook URL points to production endpoint
- [ ] Switch Stripe to live mode
- [ ] Test with real $1 purchase (refund after verification)
- [ ] Monitor Worker logs for first 24 hours: `npx wrangler tail`
- [ ] Set up error alerting in Cloudflare dashboard

---

## Monitoring & Operations

### View Worker Logs
```bash
npx wrangler tail
```

### Query Database
```bash
# Recent purchases
npx wrangler d1 execute arbinq-purchases --remote \
  --command "SELECT * FROM purchases ORDER BY created_at DESC LIMIT 10"

# Recent downloads
npx wrangler d1 execute arbinq-purchases --remote \
  --command "SELECT d.*, p.email FROM downloads d JOIN purchases p ON d.purchase_id = p.id ORDER BY d.downloaded_at DESC LIMIT 10"

# Email delivery status
npx wrangler d1 execute arbinq-purchases --remote \
  --command "SELECT id, email, created_at, download_urls_sent_at FROM purchases WHERE download_urls_sent_at IS NOT NULL ORDER BY created_at DESC LIMIT 10"
```

### Manually Resend Download Links
```bash
curl -X POST https://arbinq-api.workers.dev/api/admin/resend-download-links \
  -H "Authorization: Bearer 85a8a543b89386a4ab7c649834277b5173c399eea0c9c2cb30add35ddcd43614" \
  -H "Content-Type: application/json" \
  -d '{"purchase_id": "cs_live_..."}'
```

---

## Future Enhancements (Phase 3+)

Once user accounts are implemented (Clerk):
- Link purchases to Clerk user IDs
- Add `/dashboard/downloads` page showing all purchases
- Allow re-download from dashboard without email
- Generate unique license keys per purchase
- Implement software activation/validation
- Send version update notifications
- Track which version each customer downloaded

---

## Cost Breakdown

At 100 purchases/month:
- R2 storage: ~150MB = **$0.01**
- R2 operations: ~300 downloads = **free**
- Workers requests: ~300 = **free**
- D1 reads/writes: ~600 = **free**
- Resend emails: 100 = **free**

**Total: ~$0.01/month**

Paid tier needed at 3,000+ purchases/month → Resend $20/month.
At that scale: $60,000 monthly revenue, $20 infrastructure cost = 0.03%.

---

## Support

For issues:
- Check Worker logs: `npx wrangler tail`
- Check Resend dashboard for email delivery status
- Check Stripe dashboard for webhook delivery status
- Verify secrets are set: secrets don't show their values, but you can confirm they exist
- See `worker/README.md` for detailed troubleshooting guide
