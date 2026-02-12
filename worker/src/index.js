// ArbInq API Worker
// Routes: GitHub OAuth (for Decap CMS), health check, Stripe stubs

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
      // TODO: Stripe webhook — handle checkout.session.completed, store in D1
      // Needs: STRIPE_WEBHOOK_SECRET env var
      return jsonResponse({ error: "Not implemented" }, 501);
    }

    return corsResponse("Not found", { status: 404 });
  },
};
