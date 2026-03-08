// ArbInq API Worker
// Routes: GitHub OAuth (Decap CMS), Stripe Checkout, Stripe Webhook, Software Download

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Product registry — maps product_id to R2 key and display info
const PRODUCTS = {
  simplesight: {
    name: "SimpleSight Device Inventory",
    file: "simplesight/SimpleSightServerInstaller.exe",
    filename: "SimpleSightServerInstaller.exe",
  },
};

// --- Helpers ---

function corsResponse(body, init = {}) {
  const res = new Response(body, init);
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

function jsonResponse(data, status = 200) {
  return corsResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Stripe REST API helper — no npm package, just fetch
async function stripeRequest(env, method, path, params = null) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  return res.json();
}

// Stripe webhook signature verification using Web Crypto (no SDK needed)
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
  const timestamp = parts.t;
  const sig = parts.v1;
  if (!timestamp || !sig) return false;

  // Reject webhooks older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sig;
}

// Send email via Fastmail JMAP API
// Requires env: FASTMAIL_API_TOKEN, FASTMAIL_ACCOUNT_ID, FASTMAIL_SENT_MAILBOX_ID, FASTMAIL_FROM_EMAIL
async function sendEmail(env, { to, subject, text }) {
  const res = await fetch("https://api.fastmail.com/jmap/api/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FASTMAIL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      using: [
        "urn:ietf:params:jmap:core",
        "urn:ietf:params:jmap:mail",
        "urn:ietf:params:jmap:submission",
      ],
      methodCalls: [
        ["Email/set", {
          accountId: env.FASTMAIL_ACCOUNT_ID,
          create: {
            e1: {
              mailboxIds: { [env.FASTMAIL_SENT_MAILBOX_ID]: true },
              from: [{ email: env.FASTMAIL_FROM_EMAIL, name: "ArbInq" }],
              to: [{ email: to }],
              subject,
              bodyValues: { body: { value: text, charset: "utf-8" } },
              textBody: [{ partId: "body", type: "text/plain" }],
            },
          },
        }, "m1"],
        ["EmailSubmission/set", {
          accountId: env.FASTMAIL_ACCOUNT_ID,
          create: {
            s1: { emailId: "#e1" },
          },
        }, "m2"],
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fastmail JMAP error ${res.status}: ${body}`);
  }
  return res.json();
}

// SHA-256 hex of lower-cased email — stable key for future account linking
async function hashEmail(email) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase())
  );
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildDeliveryEmail(productName, downloadUrl) {
  return `Thank you for purchasing ${productName}!

Your download link is ready:

  ${downloadUrl}

This link is valid for 72 hours and allows up to 5 downloads. Save the file
somewhere safe — you own it forever.

If you have any trouble, reply to this email or reach us at andrew@arbinquiry.com.

— The ArbInq Team`;
}

// --- Main handler ---

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { method } = request;
    const { pathname } = url;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // --- GitHub OAuth (Decap CMS) ---

    if (method === "GET" && pathname === "/auth") {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: "repo,user",
        redirect_uri: `${url.origin}/callback`,
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
        302
      );
    }

    if (method === "GET" && pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return corsResponse("Missing code parameter", { status: 400 });
      }

      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
          }),
        }
      );

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return corsResponse(`GitHub error: ${tokenData.error_description}`, {
          status: 400,
        });
      }

      const message = JSON.stringify({
        token: tokenData.access_token,
        provider: "github",
      });

      const html = `<!DOCTYPE html><html><body><script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:${message.replace(/'/g, "\\'")}',
      e.origin
    );
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
</script></body></html>`;

      return new Response(html, {
        headers: { ...CORS_HEADERS, "Content-Type": "text/html" },
      });
    }

    // --- API routes ---

    if (method === "GET" && pathname === "/api/health") {
      return jsonResponse({ status: "ok" });
    }

    // POST /api/checkout — create a Stripe Checkout Session and return its URL
    if (method === "POST" && pathname === "/api/checkout") {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON" }, 400);
      }

      const { product_id = "simplesight", icp_slug = "" } = body;

      const product = PRODUCTS[product_id];
      if (!product) return jsonResponse({ error: "Unknown product" }, 400);

      // Price ID is stored as an env secret, e.g. SIMPLESIGHT_PRICE_ID
      const priceId = env[`${product_id.toUpperCase()}_PRICE_ID`];
      if (!priceId) {
        return jsonResponse({ error: "Product not yet configured for purchase" }, 503);
      }

      const siteUrl = env.SITE_URL || "https://arbinquiry.com";

      const session = await stripeRequest(env, "POST", "/checkout/sessions", {
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        mode: "payment",
        success_url: `${siteUrl}/products/device-inventory/success/`,
        cancel_url: `${siteUrl}/products/device-inventory/`,
        customer_creation: "always",
        "metadata[product_id]": product_id,
        "metadata[icp_slug]": icp_slug,
      });

      if (session.error) {
        console.error("Stripe error:", session.error);
        return jsonResponse({ error: session.error.message }, 502);
      }

      return jsonResponse({ url: session.url });
    }

    // POST /api/webhooks/stripe — verify signature, store purchase, email download link
    if (method === "POST" && pathname === "/api/webhooks/stripe") {
      const payload = await request.text();
      const sig = request.headers.get("stripe-signature");

      if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
        return jsonResponse({ error: "Missing signature" }, 400);
      }

      const valid = await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
      if (!valid) {
        return jsonResponse({ error: "Invalid signature" }, 401);
      }

      const event = JSON.parse(payload);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const email = session.customer_details?.email;
        const productId = session.metadata?.product_id || "simplesight";
        const icpSlug = session.metadata?.icp_slug || null;
        const amount = session.amount_total;

        if (!email) {
          console.error("checkout.session.completed missing email, session:", session.id);
          return jsonResponse({ received: true });
        }

        const customerHash = await hashEmail(email);
        const now = new Date().toISOString();

        // Upsert customer record — grandfathers this buyer into a future account system.
        // The email_hash is a stable, account-system-agnostic identity key.
        await env.DB.prepare(
          `INSERT OR IGNORE INTO customers (email_hash, created_at) VALUES (?, ?)`
        ).bind(customerHash, now).run();

        // Record the purchase (idempotent — session ID is the primary key)
        await env.DB.prepare(
          `INSERT OR IGNORE INTO purchases (id, customer_hash, email, product_id, amount, icp_slug, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(session.id, customerHash, email, productId, amount, icpSlug, now).run();

        // Generate a unique download token valid for 72 hours
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

        await env.DB.prepare(
          `INSERT INTO download_tokens (token, purchase_id, product_id, email, expires_at, download_count, max_downloads)
           VALUES (?, ?, ?, ?, ?, 0, 5)`
        ).bind(token, session.id, productId, email, expiresAt).run();

        // Build the download URL (points to this worker)
        const workerUrl = env.WORKER_URL || url.origin;
        const downloadUrl = `${workerUrl}/api/download?token=${token}`;

        const product = PRODUCTS[productId];
        try {
          await sendEmail(env, {
            to: email,
            subject: `Your ${product?.name || productId} download is ready`,
            text: buildDeliveryEmail(product?.name || productId, downloadUrl),
          });
        } catch (err) {
          // Log but don't return a non-2xx — Stripe retries on failure, which
          // would create duplicate tokens. Email failures need manual follow-up.
          console.error("Failed to send delivery email:", err.message);
        }
      }

      return jsonResponse({ received: true });
    }

    // GET /api/download?token=UUID — validate token and stream software from R2
    if (method === "GET" && pathname === "/api/download") {
      const token = url.searchParams.get("token");
      if (!token) {
        return corsResponse("Missing token parameter", { status: 400 });
      }

      const row = await env.DB.prepare(
        "SELECT * FROM download_tokens WHERE token = ?"
      ).bind(token).first();

      if (!row) {
        return corsResponse("Download link not found. It may have already been used up or never existed.", { status: 404 });
      }

      if (new Date(row.expires_at) < new Date()) {
        return corsResponse(
          "This download link has expired (72-hour window). Contact andrew@arbinquiry.com with your order email and we'll send a new one.",
          { status: 410 }
        );
      }

      if (row.download_count >= row.max_downloads) {
        return corsResponse(
          "Download limit reached (5 downloads). Contact andrew@arbinquiry.com if you need additional downloads.",
          { status: 410 }
        );
      }

      const product = PRODUCTS[row.product_id];
      if (!product) {
        return corsResponse("Unknown product", { status: 400 });
      }

      // Increment download counter before serving — prevents race-condition overuse
      await env.DB.prepare(
        "UPDATE download_tokens SET download_count = download_count + 1 WHERE token = ?"
      ).bind(token).run();

      const object = await env.SOFTWARE.get(product.file);
      if (!object) {
        return corsResponse(
          "File temporarily unavailable. Contact andrew@arbinquiry.com and we'll get it to you right away.",
          { status: 503 }
        );
      }

      return new Response(object.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${product.filename}"`,
          "Content-Length": object.size?.toString() ?? "",
          "Cache-Control": "no-store",
        },
      });
    }

    return corsResponse("Not found", { status: 404 });
  },
};
