import { html, raw } from "./html.mjs";
import { icon } from "./icons.mjs";
import { page, absUrl } from "./layout.mjs";
import { renderBlock } from "./blocks.mjs";
import { renderMarkdown } from "../../shared/markdown.mjs";
import { projectCard, newsCard, statusBadge, button, sectionHead, formatDate, picture, linkKindIcon, youtubeId, projectMedia } from "./components.mjs";
import { CATEGORIES } from "../../shared/schema.mjs";

const crumbs = (ctx, items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absUrl(ctx.site, it.path) })),
});

const breadcrumb = (items) => html`<nav class="breadcrumb" aria-label="Breadcrumb"><ol role="list">
  ${items.map((it, i) => i < items.length - 1 ? html`<li><a href="${it.path}">${it.name}</a></li>` : html`<li aria-current="page">${it.name}</li>`)}
</ol></nav>`;

/* ------------------------------------------------------------------ home */
export function homePage(ctx) {
  const { site } = ctx;
  const featured = ctx.projects.filter((p) => p.featured);
  const latest = ctx.news.slice(0, 3);
  const discord = (site.social || []).find((s) => s.icon === "discord" && s.url);
  const [h1a, ...h1b] = site.hero.headline.split(" ");
  const body = html`
<section class="hero hero-home">
  <div class="hero-bg" aria-hidden="true"><div class="hero-grid"></div><div class="hero-glow"></div><img class="hero-mark" src="/assets/img/brand/mark-outline.svg" alt=""></div>
  <div class="container hero-inner">
    <div class="hero-copy">
      <img class="hero-logo" src="/assets/img/brand/mark.svg" alt="Jonaz Productions" width="48" height="56">
      <p class="eyebrow">${site.hero.eyebrow}</p>
      <h1 class="display">${h1a} <span class="accent">${h1b.join(" ")}</span></h1>
      <p class="lead">${site.hero.text}</p>
      <div class="actions">
        ${button("/projects/", "Explore Projects", { iconName: "arrow" })}
        ${button("/news/", "Latest News", { kind: "ghost", iconName: "news" })}
      </div>
    </div>
    <div class="hero-stack" aria-label="Featured projects">
      ${featured.slice(0, 2).map((p, i) => html`<a class="stack-card stack-${i} tile-${p.theme}" href="/projects/${p.slug}/">
        ${p.cover ? picture(p.cover, "", { sizes: "480px", eager: i === 0 }) : html`<span class="stack-tile"><img src="${p.logo}" alt=""></span>`}
        <span class="stack-label"><strong>${p.name}</strong>${statusBadge(p.status)}</span>
      </a>`)}
    </div>
  </div>
</section>

<section class="block" aria-labelledby="featured-title">
  <div class="container">
    <div class="section-row">${sectionHead({ eyebrow: "Featured", title: "Flagship projects", id: "featured" })}<a class="text-link" href="/projects/">All projects ${icon("arrow", { size: 16 })}</a></div>
    <div class="featured-grid">${featured.map((p, i) => projectCard(p, { large: true, eager: false }))}</div>
  </div>
</section>

<section class="block" aria-labelledby="latest-title">
  <div class="container">
    <div class="section-row">${sectionHead({ eyebrow: "News", title: "Latest announcements", id: "latest" })}<a class="text-link" href="/news/">All news ${icon("arrow", { size: 16 })}</a></div>
    ${latest.length ? html`<div class="news-grid">${latest.map((n) => newsCard(n, ctx))}</div>` : html`<div class="empty-state"><p>No news yet.</p></div>`}
  </div>
</section>

<section class="block block-about" aria-labelledby="about-title">
  <div class="container about-split">
    <div>${sectionHead({ eyebrow: "About the studio", title: "Independent by design.", id: "about" })}
      <p class="lead">${site.about.intro}</p>
      <p>${site.about.vision}</p>
      ${button("/about/", "About Jonaz Productions", { kind: "ghost", iconName: "arrow" })}
    </div>
    <ol class="principles" role="list">${(site.about.philosophy || []).map((x, i) => html`<li data-reveal><span>${String(i + 1).padStart(2, "0")}</span><div><h3>${x.title}</h3><p>${x.text}</p></div></li>`)}</ol>
  </div>
</section>

<section class="block">
  <div class="container"><div class="cta" data-reveal>
    <div><h2 class="section-title">Follow the work.</h2><p>Release news, betas and development updates, first in the community.</p></div>
    <div class="cta-actions">${discord ? button(discord.url, "Join the Discord", { iconName: "discord" }) : ""}${button("/contact/", "Contact", { kind: "ghost", iconName: "mail" })}</div>
  </div></div>
</section>`;
  return page(ctx, {
    path: "/", active: "home", body,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "Organization", name: site.name, url: absUrl(site, "/"), logo: absUrl(site, "/assets/img/brand/icon-512.png"), sameAs: (site.social || []).filter((s) => s.url).map((s) => s.url) },
      { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: absUrl(site, "/") },
    ],
  });
}

/* ------------------------------------------------------------------ projects */
export function projectsPage(ctx) {
  const cats = CATEGORIES.filter((c) => ctx.projects.some((p) => p.category === c));
  const body = html`
<section class="page-head"><div class="container">
  ${sectionHead({ eyebrow: "Projects", title: "Everything we're building.", intro: "Software, Minecraft projects and games by Jonaz Productions. Each status shows exactly where a project stands.", level: 1 })}
  ${cats.length > 1 ? html`<div class="filters" role="group" aria-label="Filter projects by category" data-filter="projects">
    <button type="button" class="chip" aria-pressed="true" data-value="all">All</button>
    ${cats.map((c) => html`<button type="button" class="chip" aria-pressed="false" data-value="${c}">${c}</button>`)}
  </div>` : ""}
</div></section>
<section class="block block-tight"><div class="container">
  <div class="projects-grid" data-filter-list="projects">${ctx.projects.map((p) => projectCard(p))}</div>
  <p class="filter-empty" data-filter-empty="projects" hidden>No projects in this category yet.</p>
</div></section>`;
  return page(ctx, { title: "Projects", description: "All projects by Jonaz Productions: MLBClient, Operation Iron Veil, QuickClient and what comes next.", path: "/projects/", active: "projects", body, jsonLd: crumbs(ctx, [{ name: "Home", path: "/" }, { name: "Projects", path: "/projects/" }]) });
}

function projectHero(p, ctx) {
  const release = (p.sections || []).find((s) => s.type === "release");
  const hasDownload = release && (release.downloads || []).some((d) => d.url);
  const trailer = p.hero?.trailer && youtubeId(p.hero.trailer) ? (p.sections || []).find((s) => s.type === "video") : null;
  const links = p.links || [];
  const actions = [];
  if (hasDownload) actions.push(button(`#${release.id || "download"}`, "Download", { iconName: "download", external: false }));
  else if (release) actions.push(button(`#${release.id || "download"}`, "Release info", { iconName: "clock", external: false }));
  if (trailer) actions.push(button(`#${trailer.id || "trailer"}`, "Watch trailer", { kind: "ghost", iconName: "play", external: false }));
  links.forEach((l) => actions.push(button(l.url, l.label, { kind: actions.length ? "ghost" : "primary", iconName: linkKindIcon(l.kind) })));
  actions.splice(3);

  if (p.theme === "ironveil") {
    return html`<section class="iv-hero">
      <div class="iv-hero-bg" aria-hidden="true">
        <div class="iv-sky"></div><div class="iv-beam iv-beam-1"></div><div class="iv-beam iv-beam-2"></div>
        <svg class="iv-signal" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 H380 l18-34 22 70 20-52 16 30 14-14 H1200"/></svg>
        <div class="iv-embers">${raw("<i></i>".repeat(14))}</div>
        <div class="iv-grain"></div>
      </div>
      <div class="container iv-hero-inner">
        ${breadcrumb([{ name: "Home", path: "/" }, { name: "Projects", path: "/projects/" }, { name: p.name }])}
        <p class="iv-eyebrow">${p.hero?.eyebrow || p.category}</p>
        <h1 class="iv-title"><img src="${p.logo}" alt="${p.name}" width="694" height="180"></h1>
        ${p.hero?.quote ? html`<p class="iv-quote">“${p.hero.quote}”</p>` : ""}
        <p class="iv-lead">${p.summary}</p>
        <div class="iv-meta">${statusBadge(p.status)}${(p.tags || []).map((t) => html`<span class="tag">${t}</span>`)}</div>
        ${actions.length ? html`<div class="actions">${actions}</div>` : ""}
      </div>
    </section>`;
  }

  return html`<section class="p-hero">
    <div class="p-hero-bg" aria-hidden="true"></div>
    <div class="container">
      ${breadcrumb([{ name: "Home", path: "/" }, { name: "Projects", path: "/projects/" }, { name: p.name }])}
      <div class="p-hero-grid">
        <div class="p-hero-copy">
          <div class="p-id">${p.logo ? html`<img src="${p.logo}" alt="" width="64" height="64">` : ""}<div><p class="eyebrow">${p.hero?.eyebrow || p.category}</p><p class="p-name">${p.name}</p></div></div>
          <h1 class="display">${p.hero?.headline || p.tagline || p.name}</h1>
          <p class="lead">${p.description || p.summary}</p>
          <div class="p-meta">${statusBadge(p.status)}${(p.tags || []).map((t) => html`<span class="tag">${t}</span>`)}</div>
          ${actions.length ? html`<div class="actions">${actions}</div>` : ""}
        </div>
        ${p.cover ? html`<div class="p-hero-media"><div class="frame">${picture(p.cover, p.coverAlt, { sizes: "(min-width: 960px) 620px, 100vw", eager: true })}</div></div>`
          : p.logo ? html`<div class="p-hero-media" aria-hidden="true"><div class="frame frame-tile">${projectMedia(p)}</div></div>` : ""}
      </div>
    </div>
  </section>`;
}

function subnav(p) {
  const items = (p.sections || []).filter((s) => s.id && s.title && !["cta", "quote", "placeholder"].includes(s.type));
  if (items.length < 3) return "";
  const short = (s) => ({ release: "Release", features: s.eyebrow || "Features", video: "Trailer", gallery: "Media", changelog: "Changelog", upcoming: "Upcoming", news: "News", characters: "Characters", timeline: "Campaign", story: "Story", status: "Status", facts: "Facts", feed: "In-game news" }[s.type] || s.title);
  return html`<nav class="subnav" aria-label="${p.name} sections"><div class="container"><ul role="list">
    ${items.map((s) => html`<li><a href="#${s.id}">${short(s)}</a></li>`)}
  </ul></div></nav>`;
}

export function projectPage(p, ctx) {
  const body = html`${projectHero(p, ctx)}${subnav(p)}
<div class="p-sections">${(p.sections || []).map((b) => renderBlock(b, p, ctx))}</div>
<section class="block block-tight"><div class="container more-projects">
  <h2 class="footer-title">More projects</h2>
  <ul role="list">${ctx.projects.filter((x) => x.slug !== p.slug).map((x) => html`<li><a href="/projects/${x.slug}/">${x.icon || x.logo ? html`<img src="${x.icon || x.logo}" alt="" width="28" height="28">` : ""}<span>${x.name}</span>${icon("arrow", { size: 16 })}</a></li>`)}</ul>
</div></section>`;
  const type = p.category === "Games" ? "VideoGame" : "SoftwareApplication";
  const ld = { "@context": "https://schema.org", "@type": type, name: p.name, description: p.summary, url: absUrl(ctx.site, `/projects/${p.slug}/`), author: { "@type": "Organization", name: ctx.site.name } };
  if (type === "SoftwareApplication") ld.applicationCategory = "GameApplication";
  return page(ctx, {
    title: p.seo?.title || p.name, description: p.seo?.description || p.summary, path: `/projects/${p.slug}/`,
    active: "projects", body, theme: p.theme === "default" ? "" : p.theme, image: p.cover || "", bodyClass: `project-${p.slug}`,
    jsonLd: [ld, crumbs(ctx, [{ name: "Home", path: "/" }, { name: "Projects", path: "/projects/" }, { name: p.name, path: `/projects/${p.slug}/` }])],
  });
}

/* ------------------------------------------------------------------ news */
export function newsIndexPage(ctx) {
  const cats = [...new Set(ctx.news.map((n) => n.category))];
  const [first, ...rest] = ctx.news;
  const body = html`
<section class="page-head"><div class="container">
  ${sectionHead({ eyebrow: "News", title: "Announcements & updates.", intro: "Development updates, releases, betas, changelogs and studio news.", level: 1 })}
  ${cats.length > 1 ? html`<div class="filters" role="group" aria-label="Filter news by category" data-filter="news">
    <button type="button" class="chip" aria-pressed="true" data-value="all">All</button>
    ${cats.map((c) => html`<button type="button" class="chip" aria-pressed="false" data-value="${c}">${c}</button>`)}
  </div>` : ""}
</div></section>
<section class="block block-tight"><div class="container">
  ${first ? html`<div class="news-list" data-filter-list="news">
    <div class="news-lead">${newsCard(first, ctx)}</div>
    ${rest.map((n) => newsCard(n, ctx))}
  </div><p class="filter-empty" data-filter-empty="news" hidden>No articles in this category yet.</p>` : html`<div class="empty-state"><p>No news yet.</p></div>`}
  <p class="rss"><a href="/news/feed.xml">${icon("news", { size: 16 })} RSS feed</a></p>
</div></section>`;
  return page(ctx, { title: "News", description: "News and announcements from Jonaz Productions: development updates, releases, betas and changelogs.", path: "/news/", active: "news", body, jsonLd: crumbs(ctx, [{ name: "Home", path: "/" }, { name: "News", path: "/news/" }]) });
}

export function articlePage(n, ctx) {
  const project = n.project ? ctx.projects.find((p) => p.slug === n.project) : null;
  const i = ctx.news.indexOf(n);
  const newer = ctx.news[i - 1];
  const older = ctx.news[i + 1];
  const body = html`
<article class="article">
  <header class="article-head"><div class="container container-narrow">
    ${breadcrumb([{ name: "Home", path: "/" }, { name: "News", path: "/news/" }, { name: n.title }])}
    <p class="meta"><span class="ncat">${n.category}</span><time datetime="${n.date}">${formatDate(n.date)}</time>${project ? html`<a href="/projects/${project.slug}/">${project.name}</a>` : ""}</p>
    <h1 class="article-title">${n.title}</h1>
    ${n.excerpt ? html`<p class="lead">${n.excerpt}</p>` : ""}
  </div></header>
  ${n.cover ? html`<div class="container article-cover"><div class="frame">${picture(n.cover, n.coverAlt || "", { eager: true, sizes: "(min-width: 1100px) 1040px, 100vw" })}</div></div>` : ""}
  <div class="container container-narrow prose article-body">${raw(renderMarkdown(n.body))}</div>
  <footer class="container container-narrow article-foot">
    ${project ? html`<a class="article-project" href="/projects/${project.slug}/">${project.icon || project.logo ? html`<img src="${project.icon || project.logo}" alt="" width="40" height="40">` : ""}<span><small>Project</small><strong>${project.name}</strong></span>${icon("arrow", { size: 18 })}</a>` : ""}
    <nav class="article-pager" aria-label="More articles">
      ${older ? html`<a href="/news/${older.slug}/"><small>Older</small><span>${older.title}</span></a>` : html`<span></span>`}
      ${newer ? html`<a class="next" href="/news/${newer.slug}/"><small>Newer</small><span>${newer.title}</span></a>` : ""}
    </nav>
  </footer>
</article>`;
  return page(ctx, {
    title: n.title, description: n.excerpt, path: `/news/${n.slug}/`, active: "news", body, image: n.cover || project?.cover || "", type: "article",
    jsonLd: [
      { "@context": "https://schema.org", "@type": "NewsArticle", headline: n.title, datePublished: n.date, description: n.excerpt, image: n.cover ? [absUrl(ctx.site, n.cover)] : undefined, publisher: { "@type": "Organization", name: ctx.site.name }, mainEntityOfPage: absUrl(ctx.site, `/news/${n.slug}/`) },
      crumbs(ctx, [{ name: "Home", path: "/" }, { name: "News", path: "/news/" }, { name: n.title, path: `/news/${n.slug}/` }]),
    ],
  });
}

/* ------------------------------------------------------------------ about */
export function aboutPage(ctx) {
  const { site } = ctx;
  const a = site.about;
  const discord = (site.social || []).find((s) => s.icon === "discord" && s.url);
  const body = html`
<section class="page-head"><div class="container">
  ${sectionHead({ eyebrow: "About", title: "About Jonaz Productions", level: 1 })}
  <p class="lead lead-xl">${a.intro}</p>
</div></section>
<section class="block block-tight"><div class="container about-split">
  <div>${sectionHead({ eyebrow: "Vision", title: "Why we build.", id: "vision" })}<p class="lead">${a.vision}</p></div>
  <div>${sectionHead({ eyebrow: "Philosophy", title: "How we work.", id: "philosophy" })}
    <ol class="principles" role="list">${(a.philosophy || []).map((x, i) => html`<li data-reveal><span>${String(i + 1).padStart(2, "0")}</span><div><h3>${x.title}</h3><p>${x.text}</p></div></li>`)}</ol>
  </div>
</div></section>
<section class="block"><div class="container">
  ${sectionHead({ eyebrow: "Projects", title: "What we're working on.", id: "projects" })}
  <div class="projects-grid">${ctx.projects.map((p) => projectCard(p))}</div>
</div></section>
${a.goals ? html`<section class="block"><div class="container container-narrow">${sectionHead({ eyebrow: "Future goals", title: "What comes next.", id: "goals" })}<div class="prose">${raw(renderMarkdown(a.goals))}</div></div></section>` : ""}
<section class="block"><div class="container"><div class="cta" data-reveal>
  <div><h2 class="section-title">Get in touch.</h2><p>${site.contact?.email ? html`Write to <a href="mailto:${site.contact.email}">${site.contact.email}</a> or use the contact form.` : "Use the contact form or join the community on Discord."}</p></div>
  <div class="cta-actions">${button("/contact/", "Contact", { iconName: "mail" })}${discord ? button(discord.url, "Discord", { kind: "ghost", iconName: "discord" }) : ""}</div>
</div></div></section>`;
  return page(ctx, { title: "About", description: "About Jonaz Productions: the studio, its vision, development philosophy and projects.", path: "/about/", active: "about", body, jsonLd: crumbs(ctx, [{ name: "Home", path: "/" }, { name: "About", path: "/about/" }]) });
}

/* ------------------------------------------------------------------ contact */
export function contactPage(ctx) {
  const { site } = ctx;
  const social = (site.social || []).filter((s) => s.url);
  const body = html`
<section class="page-head"><div class="container">
  ${sectionHead({ eyebrow: "Contact", title: "Let's talk.", intro: site.contact?.formIntro, level: 1 })}
</div></section>
<section class="block block-tight"><div class="container contact-grid">
  ${site.contact?.formEnabled && ctx.hosting?.contactAvailable !== false ? html`<form class="form" name="contact" method="POST" action="${ctx.hosting?.contactEndpoint === "/api/contact" ? "/api/contact" : "/contact/thanks/"}" data-endpoint="${ctx.hosting?.contactEndpoint || "/"}" data-netlify="true" netlify-honeypot="company" data-contact-form novalidate>
    <input type="hidden" name="form-name" value="contact">
    <p class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>
    <div class="field-row">
      <div class="field"><label for="f-name">Name</label><input id="f-name" name="name" autocomplete="name" required maxlength="100"><p class="field-error" id="f-name-err"></p></div>
      <div class="field"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required maxlength="200"><p class="field-error" id="f-email-err"></p></div>
    </div>
    <div class="field"><label for="f-topic">Topic</label>
      <select id="f-topic" name="topic"><option>General question</option><option>Business inquiry</option><option>Bug report</option><option>Press</option></select></div>
    <div class="field"><label for="f-message">Message</label><textarea id="f-message" name="message" rows="7" required minlength="10" maxlength="5000"></textarea><p class="field-error" id="f-message-err"></p></div>
    <p class="form-note">${ctx.hosting?.name === "vercel" ? "Your message is delivered to the studio's private Discord channel so we can answer it." : "Your message is stored by our host Netlify so we can answer it."} See <a href="/legal/">Privacy</a>.</p>
    <div class="form-actions"><button class="btn btn-primary" type="submit"><span class="btn-label">Send message</span><span class="spinner" aria-hidden="true"></span></button></div>
    <div class="form-status" role="status" aria-live="polite" tabindex="-1"></div>
  </form>` : html`<div class="empty-state"><p>The contact form is currently closed. Please reach us on Discord.</p></div>`}
  <aside class="contact-side">
    ${site.contact?.email ? html`<div class="contact-box"><h2 class="footer-title">Business contact</h2><a href="mailto:${site.contact.email}">${icon("mail", { size: 18 })} ${site.contact.email}</a></div>` : ""}
    ${social.length ? html`<div class="contact-box"><h2 class="footer-title">Community & social</h2><ul role="list" class="contact-links">${social.map((s) => html`<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${icon(s.icon || "globe", { size: 18 })}<span>${s.icon === "discord" && site.contact?.discordLabel ? site.contact.discordLabel : s.label}</span>${icon("external", { size: 14 })}</a></li>`)}</ul></div>` : ""}
  </aside>
</div></section>`;
  return page(ctx, { title: "Contact", description: "Contact Jonaz Productions: contact form, Discord community and social links.", path: "/contact/", active: "contact", body });
}

export function thanksPage(ctx) {
  const body = html`<section class="page-head page-center"><div class="container container-narrow">
    ${sectionHead({ eyebrow: "Contact", title: "Message sent.", intro: "Thanks for writing. We'll get back to you as soon as we can.", level: 1 })}
    ${button("/", "Back to home", { kind: "ghost", iconName: "arrow" })}
  </div></section>`;
  return page(ctx, { title: "Message sent", path: "/contact/thanks/", body, noindex: true });
}

export function legalPage(ctx) {
  const l = ctx.site.legal || {};
  const body = html`<section class="page-head"><div class="container container-narrow">
    ${sectionHead({ eyebrow: "Legal", title: "Privacy & legal", level: 1 })}
  </div></section>
  <section class="block block-tight"><div class="container container-narrow prose">
    ${l.imprint ? html`<h2 id="imprint">Imprint</h2>${raw(renderMarkdown(l.imprint))}` : ""}
    <h2 id="privacy">Privacy</h2>${raw(renderMarkdown(l.privacy || ""))}
    ${l.disclaimer ? html`<h2 id="disclaimer">Disclaimer</h2><p>${l.disclaimer}</p>` : ""}
  </div></section>`;
  return page(ctx, { title: "Privacy & legal", description: "Privacy information and legal notes for the Jonaz Productions website.", path: "/legal/", body });
}

export function notFoundPage(ctx) {
  const body = html`<section class="page-head page-center"><div class="container container-narrow">
    <p class="code-404">404</p>
    ${sectionHead({ title: "This page doesn't exist.", intro: "It may have moved. Try one of these instead.", level: 1 })}
    <div class="actions">${button("/", "Home", { iconName: "arrow" })}${button("/projects/", "Projects", { kind: "ghost" })}${button("/news/", "News", { kind: "ghost" })}</div>
  </div></section>`;
  return page(ctx, { title: "Page not found", path: "/404.html", body, noindex: true });
}
