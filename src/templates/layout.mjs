import { html, raw } from "./html.mjs";
import { icon } from "./icons.mjs";

export const ASSET_VERSION = { v: "" }; // set by the build (cache busting for CSS/JS)

const NAV = [
  { href: "/", label: "Home", key: "home" },
  { href: "/projects/", label: "Projects", key: "projects", menu: true },
  { href: "/news/", label: "News", key: "news" },
  { href: "/about/", label: "About", key: "about" },
  { href: "/contact/", label: "Contact", key: "contact" },
];

export function absUrl(site, path) {
  const base = (site.url || "").replace(/\/$/, "");
  if (!path) return base + "/";
  if (/^https?:/.test(path)) return path;
  return base + path;
}

function projectMenu(ctx) {
  const list = ctx.projects.filter((p) => p.featured).concat(ctx.projects.filter((p) => !p.featured));
  return html`<div class="dropdown" id="menu-projects">
    <ul role="list">
      ${list.map((p) => html`<li><a class="dropdown-item" href="/projects/${p.slug}/">
        <span class="dropdown-logo">${p.icon || p.logo ? html`<img src="${p.icon || p.logo}" alt="" width="28" height="28">` : ""}</span>
        <span><strong>${p.name}</strong><small>${p.category} · ${p.status.label || p.status.stageLabel}</small></span>
      </a></li>`)}
    </ul>
    <a class="dropdown-all" href="/projects/">All projects ${icon("arrow", { size: 16 })}</a>
  </div>`;
}

function header(ctx, active) {
  return html`<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="brand" href="/" aria-label="Jonaz Productions, home">
      <img src="/assets/img/brand/mark.svg" alt="" width="26" height="30">
      <span class="brand-word"><span>JONAZ</span> <span class="brand-sub">PRODUCTIONS</span></span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
      <span class="sr-only">Menu</span>${icon("menu", { cls: "i-open" })}${icon("close", { cls: "i-close" })}
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul role="list" class="nav-list">
        ${NAV.map((n) => n.menu
          ? html`<li class="nav-item has-menu" data-menu>
              <a href="${n.href}" ${active === n.key ? raw('aria-current="page"') : ""}>${n.label}</a>
              <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-projects" data-menu-toggle>
                <span class="sr-only">Show projects</span>${icon("chevron", { size: 16 })}
              </button>
              ${projectMenu(ctx)}
            </li>`
          : html`<li class="nav-item"><a href="${n.href}" ${active === n.key ? raw('aria-current="page"') : ""}>${n.label}</a></li>`)}
      </ul>
    </nav>
  </div>
</header>`;
}

function footer(ctx) {
  const { site } = ctx;
  const social = (site.social || []).filter((s) => s.url);
  const year = new Date().getFullYear();
  return html`<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a class="brand" href="/"><img src="/assets/img/brand/mark.svg" alt="" width="26" height="30"><span class="brand-word"><span>JONAZ</span> <span class="brand-sub">PRODUCTIONS</span></span></a>
      <p>${site.description}</p>
      ${social.length ? html`<ul class="social" role="list">${social.map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${icon(s.icon || "globe", { label: s.label })}</a></li>`)}</ul>` : ""}
    </div>
    <nav aria-label="Footer">
      <h2 class="footer-title">Navigation</h2>
      <ul role="list">${NAV.map((n) => html`<li><a href="${n.href}">${n.label}</a></li>`)}</ul>
    </nav>
    <div>
      <h2 class="footer-title">Projects</h2>
      <ul role="list">${ctx.projects.map((p) => html`<li><a href="/projects/${p.slug}/">${p.name}</a></li>`)}</ul>
    </div>
    <div>
      <h2 class="footer-title">Contact</h2>
      <ul role="list">
        <li><a href="/contact/">Contact form</a></li>
        ${site.contact?.email ? html`<li><a href="mailto:${site.contact.email}">${site.contact.email}</a></li>` : ""}
        ${social.filter((s) => s.icon === "discord").map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label}</a></li>`)}
      </ul>
      <h2 class="footer-title">Legal</h2>
      <ul role="list"><li><a href="/legal/">Privacy & legal</a></li>${site.legal?.imprint ? html`<li><a href="/legal/#imprint">Imprint</a></li>` : ""}</ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${year} Jonaz Productions. All rights reserved.</span>
    ${site.legal?.disclaimer ? html`<span>${site.legal.disclaimer}</span>` : ""}
  </div>
</footer>`;
}

export function page(ctx, { title, description, path, active = "", body, theme = "", image = "", type = "website", jsonLd = null, noindex = false }) {
  const { site } = ctx;
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name} – ${site.hero.headline.replace(/\.$/, "")}`;
  const desc = description || site.description;
  const url = absUrl(site, path);
  const img = absUrl(site, image || "/assets/img/brand/og.png");
  const v = ASSET_VERSION.v ? `?v=${ASSET_VERSION.v}` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html`${fullTitle}`}</title>
<meta name="description" content="${html`${desc}`}">
<link rel="canonical" href="${html`${url}`}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta name="theme-color" content="${theme === "mlbclient" ? "#120b10" : theme === "ironveil" ? "#0d0b09" : "#0b0c0e"}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${html`${site.name}`}">
<meta property="og:title" content="${html`${title || site.name}`}">
<meta property="og:description" content="${html`${desc}`}">
<meta property="og:url" content="${html`${url}`}">
<meta property="og:image" content="${html`${img}`}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/img/brand/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/assets/img/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/brand/apple-touch-icon.png">
<link rel="icon" href="/assets/img/brand/icon-512.png" sizes="512x512" type="image/png">
<link rel="preload" href="/assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css${v}">
<link rel="alternate" type="application/rss+xml" title="${html`${site.name} News`}" href="/news/feed.xml">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>\n` : ""}<script src="/assets/js/site.js${v}" defer></script>
</head>
<body class="${theme ? `theme-${theme}` : "theme-studio"}">
<a class="skip-link" href="#main">Skip to content</a>
${header(ctx, active)}
<main id="main" tabindex="-1">
${body}
</main>
${footer(ctx)}
</body>
</html>
`;
}
