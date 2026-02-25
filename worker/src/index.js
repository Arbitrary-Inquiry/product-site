// ArbInq API Worker
// Routes: GitHub OAuth (Decap CMS), Stripe webhooks, SimpleSight downloads

import { AwsClient } from 'aws4fetch';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// File configuration for SimpleSight installers
const DOWNLOAD_FILES = {
  server: {
    path: "simplesight/server/SimpleSightServerInstaller.exe",
    description: "SimpleSight Server Installer",
    size_mb: "~130MB",
  },
  agent: {
    path: "simplesight/agent/SimpleSightInstaller.exe",
    description: "SimpleSight Agent Installer",
    size_mb: "~20-25MB",
  },
};

const DOWNLOAD_WINDOW_DAYS = 30;

// ============================================================================
// Utility Functions
// ============================================================================

function corsResponse(body, init = {}) {
  const res = new Response(body, init);
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

function jsonResponse(data, status = 200) {
  return corsResponse(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function generateUUID() {
  return crypto.randomUUID();
}

function getCurrentTimestamp() {
  return new Date().toISOString();
}

// ============================================================================
// Stripe Webhook Verification
// ============================================================================

async function verifyStripeSignature(request, secret) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return { valid: false, error: "Missing signature" };
  }

  const parts = signature.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signatures = [parts.v1]; // Stripe uses v1 scheme

  if (!timestamp) {
    return { valid: false, error: "Missing timestamp" };
  }

  // Check timestamp is recent (5 minutes tolerance)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    return { valid: false, error: "Timestamp too old" };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature_bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const expectedSignature = Array.from(new Uint8Array(signature_bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Compare signatures
  if (!signatures.includes(expectedSignature)) {
    return { valid: false, error: "Signature mismatch" };
  }

  return { valid: true, payload: JSON.parse(payload) };
}

// ============================================================================
// Email Delivery (Resend API)
// ============================================================================

async function sendDownloadEmail(email, purchaseId, originUrl, env) {
  const downloadBaseUrl = `${originUrl}/api/download/${purchaseId}`;

  const emailBody = `Thanks for your purchase! Download your SimpleSight installers below:

SERVER INSTALLER (~130MB)
${downloadBaseUrl}/server

AGENT INSTALLER (~20-25MB)
${downloadBaseUrl}/agent

DOCUMENTATION
- README: https://arbinquiry.com/docs/README.txt
- Deployment Guide: https://arbinquiry.com/docs/DEPLOYMENT_GUIDE.txt
- Network Configuration: https://arbinquiry.com/docs/NETWORK_CONFIGURATION.txt
- Troubleshooting: https://arbinquiry.com/docs/TROUBLESHOOTING.txt

These links will work for ${DOWNLOAD_WINDOW_DAYS} days. Need new links?
Email support@arbinquiry.com with your purchase confirmation.

- The ArbInq Team`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ArbInq <no-reply@arbinquiry.com>",
      to: email,
      subject: "Your SimpleSight Download Links",
      text: emailBody,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

// ============================================================================
// R2 Presigned URL Generation
// ============================================================================

async function generatePresignedUrl(fileKey, expireSeconds, env) {
  // R2 endpoint format: https://<account_id>.r2.cloudflarestorage.com
  // We need to construct this from the bucket binding
  const accountId = env.R2_ACCOUNT_ID || "your-account-id"; // Set this as env var
  const bucketName = "arbinq-downloads";
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const url = new URL(`${endpoint}/${bucketName}/${fileKey}`);
  url.searchParams.set("X-Amz-Expires", expireSeconds.toString());

  const signed = await client.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });

  return signed.url;
}

// ============================================================================
// Database Operations
// ============================================================================

async function storePurchase(sessionId, email, productId, amount, icpSlug, env) {
  await env.DB.prepare(
    `INSERT INTO purchases (id, email, product_id, amount, icp_slug, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sessionId, email, productId, amount, icpSlug, getCurrentTimestamp())
    .run();
}

async function markDownloadEmailSent(purchaseId, env) {
  await env.DB.prepare(
    `UPDATE purchases SET download_urls_sent_at = ? WHERE id = ?`
  )
    .bind(getCurrentTimestamp(), purchaseId)
    .run();
}

async function getPurchase(purchaseId, env) {
  const result = await env.DB.prepare(
    `SELECT * FROM purchases WHERE id = ?`
  )
    .bind(purchaseId)
    .first();

  return result;
}

async function logDownload(purchaseId, fileKey, request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  await env.DB.prepare(
    `INSERT INTO downloads (id, purchase_id, file_key, ip_address, user_agent, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(generateUUID(), purchaseId, fileKey, ip, userAgent, getCurrentTimestamp())
    .run();
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleStripeWebhook(request, env) {
  // Verify webhook signature
  const verification = await verifyStripeSignature(request, env.STRIPE_WEBHOOK_SECRET);

  if (!verification.valid) {
    console.error("Webhook signature verification failed:", verification.error);
    return jsonResponse({ error: verification.error }, 400);
  }

  const event = verification.payload;

  // Handle checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      // Extract purchase details
      const purchaseId = session.id;
      const email = session.customer_details?.email || session.customer_email;
      const amount = session.amount_total;
      const productId = session.metadata?.product_id || "simplesight";
      const icpSlug = session.metadata?.icp_slug || null;

      if (!email) {
        throw new Error("No email found in checkout session");
      }

      // Store purchase in D1
      await storePurchase(purchaseId, email, productId, amount, icpSlug, env);

      // Send download email
      const originUrl = new URL(request.url).origin;
      await sendDownloadEmail(email, purchaseId, originUrl, env);

      // Mark email as sent
      await markDownloadEmailSent(purchaseId, env);

      console.log(`Purchase ${purchaseId} processed, email sent to ${email}`);

      return jsonResponse({ received: true, purchase_id: purchaseId });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  // Acknowledge other event types
  return jsonResponse({ received: true });
}

async function handleDownloadRequest(request, env, purchaseId, fileType) {
  // Validate file type
  if (!DOWNLOAD_FILES[fileType]) {
    return jsonResponse({ error: "Invalid file type" }, 400);
  }

  try {
    // Get purchase record
    const purchase = await getPurchase(purchaseId, env);

    if (!purchase) {
      return jsonResponse({ error: "Purchase not found" }, 404);
    }

    // Check if download window has expired
    if (purchase.download_urls_sent_at) {
      const sentDate = new Date(purchase.download_urls_sent_at);
      const expiryDate = new Date(sentDate);
      expiryDate.setDate(expiryDate.getDate() + DOWNLOAD_WINDOW_DAYS);

      if (new Date() > expiryDate) {
        return jsonResponse({
          error: "Download window expired",
          message: "Please contact support@arbinquiry.com for new download links"
        }, 410);
      }
    }

    // Log download event
    await logDownload(purchaseId, fileType, request, env);

    // Generate presigned URL (15 minute expiry)
    const fileConfig = DOWNLOAD_FILES[fileType];
    const presignedUrl = await generatePresignedUrl(fileConfig.path, 900, env);

    // Redirect to R2 presigned URL
    return Response.redirect(presignedUrl, 302);
  } catch (error) {
    console.error("Error handling download:", error);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
}

async function handleAdminResendLinks(request, env) {
  // Verify admin API key
  const authHeader = request.headers.get("Authorization");
  const expectedAuth = `Bearer ${env.ADMIN_API_KEY}`;

  if (!authHeader || authHeader !== expectedAuth) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const { purchase_id } = body;

    if (!purchase_id) {
      return jsonResponse({ error: "Missing purchase_id" }, 400);
    }

    // Verify purchase exists
    const purchase = await getPurchase(purchase_id, env);

    if (!purchase) {
      return jsonResponse({ error: "Purchase not found" }, 404);
    }

    // Send new download email
    const originUrl = new URL(request.url).origin;
    await sendDownloadEmail(purchase.email, purchase_id, originUrl, env);

    // Update timestamp
    await markDownloadEmailSent(purchase_id, env);

    console.log(`Download links resent for purchase ${purchase_id} to ${purchase.email}`);

    return jsonResponse({
      success: true,
      purchase_id,
      email: purchase.email,
      sent_at: getCurrentTimestamp()
    });
  } catch (error) {
    console.error("Error resending links:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================================================
// Main Request Handler
// ============================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { method, pathname } = { method: request.method, pathname: url.pathname };

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // --- GitHub OAuth (Decap CMS) ---

    // GET /auth — start OAuth flow
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

    // GET /callback — exchange code for token, hand off to Decap CMS
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

    // GET /api/health
    if (method === "GET" && pathname === "/api/health") {
      return jsonResponse({ status: "ok" });
    }

    // POST /api/checkout
    if (method === "POST" && pathname === "/api/checkout") {
      // TODO: Stripe checkout — create a Checkout Session and return the URL
      // Needs: STRIPE_SECRET_KEY env var, stripe_price_id from products.yaml
      return jsonResponse({ error: "Not implemented" }, 501);
    }

    // POST /api/webhooks/stripe
    if (method === "POST" && pathname === "/api/webhooks/stripe") {
      return handleStripeWebhook(request, env);
    }

    // GET /api/download/:purchase_id/:file_type
    const downloadMatch = pathname.match(/^\/api\/download\/([^/]+)\/([^/]+)$/);
    if (method === "GET" && downloadMatch) {
      const [, purchaseId, fileType] = downloadMatch;
      return handleDownloadRequest(request, env, purchaseId, fileType);
    }

    // POST /api/admin/resend-download-links
    if (method === "POST" && pathname === "/api/admin/resend-download-links") {
      return handleAdminResendLinks(request, env);
    }

    return corsResponse("Not found", { status: 404 });
  },
};
