(function () {
    var html = document.documentElement;
    var STORAGE_KEY = 'arbinq-theme';

    // Apply saved preference immediately to prevent flash
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        html.setAttribute('data-theme', saved);
    }

    function getEffectiveTheme() {
        var explicit = html.getAttribute('data-theme');
        if (explicit) return explicit;
        return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('theme-toggle');
        if (!btn) return;

        btn.addEventListener('click', function () {
            var next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', next);
            localStorage.setItem(STORAGE_KEY, next);
        });
    });

    // If system preference changes and user has no saved override, follow system
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
        if (!localStorage.getItem(STORAGE_KEY)) {
            html.removeAttribute('data-theme');
        }
    });
})();
