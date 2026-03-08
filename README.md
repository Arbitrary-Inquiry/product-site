# ArbInq Product Site

Static marketing site built with [Eleventy](https://www.11ty.dev/) and managed through [Decap CMS](https://decapcms.org/). Content is stored as YAML files committed to this repo; GitHub Actions builds and deploys to GitHub Pages on every push to `main`.

---

## Table of Contents

1. [Dev setup](#1-dev-setup)
2. [Project structure](#2-project-structure)
3. [Editing ICP content](#3-editing-icp-content)
4. [Adding a new ICP](#4-adding-a-new-icp)
5. [Editing CSS](#5-editing-css)
6. [Editing page templates](#6-editing-page-templates)
7. [The two standalone pages](#7-the-two-standalone-pages)
8. [Deploy workflow](#8-deploy-workflow)
9. [CMS (browser-based editing)](#9-cms-browser-based-editing)

---

## 1. Dev setup

Node.js is managed via nvm. If it's not active in your shell yet:

```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
```

To make this permanent, add those two lines to `~/.bashrc` or `~/.bash_profile`.

Install dependencies (one-time after cloning):
```bash
npm install
```

Build the site into `_site/`:
```bash
npm run build
```

Live-reload dev server at `http://localhost:8080`:
```bash
npm run serve
```

The `_site/` directory is gitignored — it is only ever created locally or by the CI runner.

---

## 2. Project structure

```
src/
├── _data/
│   ├── site.js              # Global: ICP list used in every nav dropdown
│   ├── icps.js              # Loads all icps/*.yaml → array at build time
│   └── icps/
│       ├── public-schools.yaml
│       ├── christian-schools.yaml
│       ├── small-business.yaml
│       ├── developers.yaml
│       ├── individuals.yaml
│       └── crypto.yaml
├── _includes/
│   ├── layouts/
│   │   ├── icp-landing.njk           # Renders every ICP landing page
│   │   └── icp-device-inventory.njk  # Renders every ICP device-inventory page
│   └── partials/
│       ├── nav.njk              # Shared nav (landing vs device-inventory style)
│       ├── footer-inject.njk    # Footer element + conditional config.js tag
│       ├── icon-monitor.njk     # SVG for Device Inventory product card
│       ├── icon-shield.njk      # SVG for Security Review product card
│       └── icon-chart.njk       # SVG for AI Classes product card
├── icps/
│   ├── icp-landing.njk           # Pagination driver → /{slug}/
│   └── icp-device-inventory.njk  # Pagination driver → /{slug}/device-inventory/
├── pages/
│   ├── index.njk                        # Root homepage  → /
│   └── products/
│       └── device-inventory.njk         # Products page  → /products/device-inventory/
├── admin/
│   ├── index.html   # Decap CMS SPA (loads from CDN, no build step)
│   └── config.yml   # CMS field schema — mirrors the YAML structure
├── css/             # All stylesheets (passthrough copied to _site/css/)
└── js/              # footer.js, config.js (passthrough copied to _site/js/)
```

**How pagination works:** `src/icps/icp-landing.njk` has a front-matter `pagination` block that loops over every entry in the `icps` data array. For each entry it renders `layouts/icp-landing.njk` and writes the output to `_site/{slug}/index.html`. Adding a YAML file to `src/_data/icps/` automatically produces two new pages on the next build.

---

## 3. Editing ICP content

Every ICP's content lives in a single YAML file: `src/_data/icps/{slug}.yaml`.

### Via CMS (recommended for non-technical edits)

Navigate to `/admin/` on the live site and log in with GitHub. The CMS presents every field as a form — no YAML editing required. Saving a change commits directly to the `main` branch and triggers a deploy.

### Via direct YAML edit

Open `src/_data/icps/{slug}.yaml` in any text editor. The structure looks like this (abbreviated):

```yaml
slug: public-schools
label: "Public Schools"
theme_css: public-schools        # → loads /css/public-schools.css

meta:
  title: "Page <title> tag text"
  device_inventory_title: "Device inventory page <title> tag text"

nav:
  cta_text: "Get Education Pricing"
  cta_href: "#"
  # di_no_cta: true   ← uncomment to hide CTA on device-inventory nav only

landing:
  hero:
    h1: "Technology Solutions for Public Schools"
    subheadline: "..."
    primary_cta_text: "Explore Products"
    primary_cta_href: "#products"
    secondary_cta_text: "Request Demo"
    secondary_cta_href: "/#contact"

  products_section:
    title: "Our Products for Public Schools"
    subtitle: "..."
    products:           # always exactly 3 items
      - name: "SimpleSight Device Inventory"
        description: "Plain text or HTML. Use <span class=\"product-price\">$20</span> for price."
        icon: monitor   # monitor | shield | chart
        features:
          - "Feature one"
          - "Feature two (use &amp; for ampersands)"
          - "Feature three"
        cta_text: "Learn More"
        cta_href: "device-inventory/"
        cta_style: outline

  extra_features_section:
    enabled: false      # set to true to show a cost-comparison grid (christian-schools example)
    title: "Cost Comparison"
    features:
      - h3: "Enterprise MDM"
        h3_style: "color: #dc2626;"   # optional inline style on the heading
        p: "$3-6 per device/month..."

  features_section:
    title: "Why Districts Choose ArbInq"
    features:           # always exactly 4 items
      - h3: "Education Pricing"
        p: "..."

  cta_section:
    h2: "Ready to Simplify District Technology Management?"
    p: "See how ArbInq can help your schools"
    button_text: "Request a Demo"
    button_href: "/#contact"

  include_config_js: false   # true if any field contains <span class="product-price">

device_inventory:
  hero:
    h1: "Device Management for Public Schools"
    p: "..."
    show_cta: true
    cta_text: "Request Education Demo"
    cta_href: "#"

  benefits:
    title: "Built for Public School Districts"
    subtitle: "..."
    cards:              # 3–8 items
      - h3: "Simple Interface"
        p: "..."

  use_cases:
    title: "Use Cases for Public Schools"
    items:              # 2–5 items
      - h3: "Student Device Assignment"
        p: "..."

  testimonial:
    enabled: true
    quote: "Quote text here (no surrounding quotes needed)."
    cite: "- Name, Title, Organization"

  extra_features_section:
    enabled: false      # see landing.extra_features_section above

  cta_section:
    h2: "..."
    p: "..."
    button_text: "Get Your Free Education Quote"
    button_href: "#"

  include_config_js: false
```

### HTML in YAML fields

Fields rendered with `| safe` (descriptions, paragraph text, feature list items) pass HTML through unescaped. Follow these rules:

| You want | Write in YAML |
|---|---|
| A literal `&` | `&amp;` |
| The price span | `<span class="product-price">$20</span>` |
| A literal `'` inside a single-quoted string | `'don&#39;t'` or use double quotes |
| Plain text with no special chars | no escaping needed |

Fields that are headings (`h1`, `h2`, `h3` in section titles, benefit cards, use cases) are **not** run through `| safe` — write plain text with literal `&`. The template auto-escapes them.

### The `include_config_js` flag

`config.js` replaces every `.product-price` span's text with the value of `SIMPLESIGHT_PRICE` at runtime, so you can change the price in one place. Set `include_config_js: true` on any page that contains a `<span class="product-price">` in its YAML. Set it to `false` on pages that have no price spans.

---

## 4. Adding a new ICP

1. Copy an existing YAML file as a starting point:
   ```bash
   cp src/_data/icps/small-business.yaml src/_data/icps/nonprofits.yaml
   ```
2. Edit the new file — update `slug`, `label`, `theme_css`, and all content fields.
3. Create a CSS file for the new theme:
   ```bash
   cp src/css/small-business.css src/css/nonprofits.css
   ```
   Then edit `src/css/nonprofits.css` to set the ICP's accent colour and any other overrides.
4. Add the new ICP to the nav dropdown list in `src/_data/site.js`:
   ```js
   { slug: "nonprofits", label: "Nonprofits" }
   ```
5. Run `npm run build`. Two new pages are generated automatically:
   - `_site/nonprofits/index.html`
   - `_site/nonprofits/device-inventory/index.html`

That's the entire process. No template changes required.

---

## 5. Editing CSS

All CSS lives in `src/css/` and is copied verbatim to `_site/css/` at build time.

| File | Used by |
|---|---|
| `base.css` | Every page — resets, layout grid, typography |
| `main.css` | Root homepage and products/device-inventory page |
| `public-schools.css` | `/public-schools/` and `/public-schools/device-inventory/` |
| `christian-schools.css` | `/christian-schools/` pages |
| `small-business.css` | `/small-business/` pages |
| `developers.css` | `/developers/` pages |
| `individuals.css` | `/individuals/` pages |
| `crypto.css` | `/crypto/` pages |

Edit the file directly — changes take effect on next build. The ICP-specific files typically just override the accent colour and hero background from `base.css`.

To change the product price site-wide, edit the single constant in `src/js/config.js`:
```js
const SIMPLESIGHT_PRICE = "$20";
```
This injects into every `.product-price` span at page load on pages where `include_config_js: true`.

---

## 6. Editing page templates

Templates are Nunjucks (`.njk`) files. You rarely need to touch them — content changes go in YAML, style changes go in CSS.

**When you do need to edit a template:**

- **Change the nav structure** → `src/_includes/partials/nav.njk`
- **Change the footer** → `src/js/footer.js` (footer is injected by JS, not a template)
- **Add a section to every ICP landing page** → `src/_includes/layouts/icp-landing.njk`
- **Add a section to every device-inventory page** → `src/_includes/layouts/icp-device-inventory.njk`
- **Change an SVG icon** → `src/_includes/partials/icon-monitor.njk` (or shield/chart)

Nunjucks syntax reference:
```njk
{{ variable }}           {# outputs a value, auto-escapes HTML #}
{{ variable | safe }}    {# outputs a value, does NOT escape HTML — use for HTML fields #}
{% if condition %}...{% endif %}
{% for item in array %}...{% endfor %}
{% include "partials/nav.njk" %}
```

The `icp` variable is the current ICP's YAML object. `site.icps` is the global list of all ICPs (used for nav dropdowns).

---

## 7. The two standalone pages

### Root homepage — `src/pages/index.njk`

The homepage is standalone HTML in a Nunjucks file. It doesn't use the ICP layout or any YAML data — edit it directly.
The nav dropdown is populated dynamically from `site.icps`, so adding an ICP automatically adds it to the homepage nav.

### Products page — `src/pages/products/device-inventory.njk`

Also standalone. This is the most content-heavy static page. Edit it directly for:
- Product card text or features
- SaaS cost comparison numbers
- Pricing card details
- Roadmap items

---

## 8. Deploy workflow

```
indev branch  →  (PR or merge)  →  main branch  →  GitHub Actions build  →  GitHub Pages
```

- **Day-to-day work** happens on `indev` (or a feature branch).
- Pushing to `main` triggers `.github/workflows/deploy.yml`, which runs `npm ci && npm run build` and deploys `_site/` to GitHub Pages.
- You do not commit `_site/` to git — it is always rebuilt from source.

**Typical commit flow:**
```bash
# Make changes to src/ files, then:
npm run build             # verify build succeeds locally before pushing
git add src/              # stage only src/ changes (not _site/)
git commit -m "Update public-schools hero copy"
git push origin indev

# When ready to deploy:
git checkout main
git merge indev
git push origin main      # triggers GitHub Actions deploy
git checkout indev
```

---

## 9. CMS (browser-based editing)

The CMS is at `/admin/` on the live site. It requires a one-time OAuth setup before first use:

1. **GitHub OAuth App** — Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: your GitHub Pages URL
   - Authorization callback URL: `https://YOUR_WORKER.workers.dev/callback`

2. **Cloudflare Worker** — Deploy the [netlify-cms-oauth-provider](https://github.com/vencax/netlify-cms-github-oauth-provider) or equivalent minimal CF Worker proxy. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as encrypted environment variables.

3. **Update `src/admin/config.yml`** — replace the two placeholder values:
   ```yaml
   backend:
     repo: Arbitrary-Inquiry/product-site
     base_url: https://YOUR_WORKER.workers.dev
   ```

4. Push to `main` and navigate to `/admin/` → log in with GitHub.

Once configured, the CMS lets you edit any ICP field, add new ICPs, and save — each save commits to `main` and triggers a deploy automatically.
