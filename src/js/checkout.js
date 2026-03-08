// checkout.js — progressive enhancement for Buy Now buttons
// Buttons with data-checkout="true" get a fetch → Stripe redirect handler.
// Falls back to the button's href if JS is unavailable or the API is unconfigured.

(function () {
  var apiBase = window.ARBINQ_CONFIG && window.ARBINQ_CONFIG.apiBase;
  if (!apiBase) return;

  function getIcpSlug() {
    // If the page is an ICP landing (e.g. /public-schools/), extract the slug.
    var match = window.location.pathname.match(/^\/([a-z][a-z0-9-]+)\//);
    var known = ["public-schools", "christian-schools", "small-business", "individuals", "crypto", "developers"];
    if (match && known.indexOf(match[1]) !== -1) return match[1];
    return "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-checkout]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();

        var productId = btn.dataset.productId || "simplesight";
        var icpSlug = btn.dataset.icpSlug || getIcpSlug();
        var originalText = btn.textContent;

        btn.textContent = "Loading\u2026";
        btn.setAttribute("aria-disabled", "true");

        fetch(apiBase + "/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId, icp_slug: icpSlug }),
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.url) {
              window.location.href = data.url;
            } else {
              throw new Error(data.error || "No checkout URL returned");
            }
          })
          .catch(function (err) {
            console.error("Checkout error:", err);
            btn.textContent = originalText;
            btn.removeAttribute("aria-disabled");
          });
      });
    });
  });
})();
