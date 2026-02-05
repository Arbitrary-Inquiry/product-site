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
                        <li><a href="#">Security Review</a></li>
                        <li><a href="#">Fleet Tracker</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Solutions</h4>
                    <ul>
                        <li><a data-link="schools">Schools</a></li>
                        <li><a data-link="small-business">Small Business</a></li>
                        <li><a data-link="developers">Developers</a></li>
                        <li><a data-link="individuals">Individuals</a></li>
                    </ul>
                </div>
                <div class="footer-col">
                    <h4>Company</h4>
                    <ul>
                        <li><a href="#">About</a></li>
                        <li><a href="#">Careers</a></li>
                        <li><a href="#">Blog</a></li>
                        <li><a href="#">Contact</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} ArbInq. All rights reserved.</p>
            </div>
        </div>
    `;

    // Calculate path prefix based on current location
    const path = window.location.pathname;
    let prefix = '';

    if (path.includes('/products/device-inventory/')) {
        prefix = '../../';
    } else if (path.includes('/schools/') ||
               path.includes('/small-business/') ||
               path.includes('/developers/') ||
               path.includes('/individuals/')) {
        prefix = '../';
    }

    footer.querySelectorAll('a[data-link]').forEach(link => {
        link.href = prefix + link.dataset.link + '/';
    });
});
