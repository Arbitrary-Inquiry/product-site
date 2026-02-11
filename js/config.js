// Change this single value to update the price everywhere on the site
const SIMPLESIGHT_PRICE = "$20";

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.product-price').forEach(function (el) {
        el.textContent = SIMPLESIGHT_PRICE;
    });
});
