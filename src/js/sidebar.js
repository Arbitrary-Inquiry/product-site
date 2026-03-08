document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.page-sidebar');
    if (!sidebar) return;

    const links = Array.from(sidebar.querySelectorAll('a[href^="#"]'));
    const sections = links
        .map(l => document.getElementById(l.getAttribute('href').slice(1)))
        .filter(Boolean);

    if (!sections.length) return;

    links[0].classList.add('active');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                links.forEach(l => l.classList.remove('active'));
                const active = sidebar.querySelector(`a[href="#${entry.target.id}"]`);
                if (active) active.classList.add('active');
            }
        });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
});
