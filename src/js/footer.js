document.addEventListener('DOMContentLoaded', function() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    footer.innerHTML = `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>ArbInq</h4>
                    <p>Asset management solutions for organizations of all sizes.</p>
                </div>
                <div class="footer-col">
                    <h4>Products</h4>
                    <ul>
                        <li><a data-link="products/device-inventory">Device Inventory</a></li>
                        <li><a data-link="code-audit">Code Audit</a></li>
                        <li><a data-link="security-review">Security Review</a></li>
                        <li><a data-link="ai-classes">AI Classes</a></li>
                        <li><a data-link="tax-services">Tax Services</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Solutions</h4>
                    <ul>
                        <li><a data-link="public-schools">Public Schools</a></li>
                        <li><a data-link="christian-schools">Christian Schools</a></li>
                        <li><a data-link="small-business">Small Business</a></li>
                        <li><a data-link="developers">Developers</a></li>
                        <li><a data-link="individuals">Individuals</a></li>
                        <li><a data-link="crypto">Crypto Traders</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Company</h4>
                    <ul>
                        <li><a data-link="about">About</a></li>
                        <li><a data-link="blog">Blog</a></li>
                        <li><a href="#">Careers</a></li>
                        <li><a data-link="contact">Contact</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} ArbInq. All rights reserved.</p>
            </div>
        </div>
    `;

    // Compute prefix by counting path depth after the site root segment.
    // e.g. /product-site/           → depth 0 → prefix ''
    //      /product-site/about/     → depth 1 → prefix '../'
    //      /product-site/blog/post/ → depth 2 → prefix '../../'
    const segments = window.location.pathname.replace(/^\//, '').split('/').filter(Boolean);
    const depth = Math.max(0, segments.length - 1);
    const prefix = '../'.repeat(depth);

    footer.querySelectorAll('a[data-link]').forEach(link => {
        link.href = prefix + link.dataset.link + '/';
    });
});
