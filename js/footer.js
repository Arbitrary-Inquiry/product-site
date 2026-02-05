document.addEventListener('DOMContentLoaded', function() {
    const footer = document.querySelector('.site-footer');
    if (!footer) return;

    footer.innerHTML = `
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>ArbInq</h4>
                    <p>Empowering businesses with innovative solutions.</p>
                </div>
                <div class="footer-col">
                    <h4>Products</h4>
                    <ul>
                        <li><a href="#">Product One</a></li>
                        <li><a href="#">Product Two</a></li>
                        <li><a href="#">Product Three</a></li>
                        <li><a href="#">Product Four</a></li>
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

    // Handle relative paths for subdomain pages
    const isSubpage = window.location.pathname.includes('/schools/') ||
                      window.location.pathname.includes('/small-business/') ||
                      window.location.pathname.includes('/developers/') ||
                      window.location.pathname.includes('/individuals/');

    const prefix = isSubpage ? '../' : '';

    footer.querySelectorAll('a[data-link]').forEach(link => {
        link.href = prefix + link.dataset.link + '/';
    });
});
