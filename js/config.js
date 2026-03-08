// Change this single value to update the price everywhere on the site
const SIMPLESIGHT_PRICE = "$20";

// API base URL — set to your deployed Worker URL.
// Get it from: wrangler deploy (outputs the workers.dev URL), or use a custom domain.
window.ARBINQ_CONFIG = {
  apiBase: "https://arbinq-api.bumpywright03.workers.dev",
};

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.product-price').forEach(function (el) {
        el.textContent = SIMPLESIGHT_PRICE;
    });
});
