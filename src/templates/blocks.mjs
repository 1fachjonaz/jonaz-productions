// Renderers for the typed content sections of project pages (content/projects/*.json -> "sections").
import { html, raw } from "./html.mjs";
import { icon, hasIcon } from "./icons.mjs";
import { renderMarkdown } from "../../shared/markdown.mjs";
import { sectionHead, picture, formatDate, newsCard, videoFacade, button, linkKindIcon } from "./components.mjs";

const wrap = (b, cls, inner) => html`<section class="block block-${b.type} ${cls || ""}" ${b.id ? raw(`id="${b.id}"${b.title ? ` aria-labelledby="${b.id}-title"` : ""}`) : ""}>
  <div class="container">${inner}</div>
</section>`;

const head = (b, intro) => sectionHead({ eyebrow: b.eyebrow, title: b.title, intro: intro ?? b.intro, id: b.id });

function gallery(items, { label = "Gallery" } = {}) {
  return html`<ul class="gallery" role="list" data-gallery aria-label="${label}">
    ${items.map((it, i) => html`<li class="gallery-item" data-reveal>
      <a href="${it.src}" class="gallery-link" data-index="${i}" data-caption="${it.caption || it.alt}">
        ${picture(it.src, it.alt, { sizes: "(min-width: 960px) 33vw, (min-width: 600px) 50vw, 100vw" })}
      </a>
      ${it.caption ? html`<p class="gallery-caption">${it.caption}</p>` : ""}
    </li>`)}
  </ul>`;
}

const R = {
  text: (b) => wrap(b, "", html`${head(b)}<div class="prose">${raw(renderMarkdown(b.body))}</div>`),

  story: (b) => wrap(b, "", html`<div class="story-grid">${head(b)}<div class="prose prose-story">${raw(renderMarkdown(b.body))}</div></div>`),

  quote: (b) => wrap(b, "", html`<figure class="quote"><blockquote>${b.text}</blockquote>${b.cite ? html`<figcaption>${b.cite}</figcaption>` : ""}</figure>`),

  features: (b) => {
    const compact = b.layout === "compact" || !(b.items || []).some((i) => i.image);
    if (compact) {
      return wrap(b, "", html`${head(b)}<ul class="features-grid" role="list">
        ${(b.items || []).map((it) => html`<li class="feature" data-reveal>
          <span class="feature-icon">${icon(hasIcon(it.icon) ? it.icon : "dot", { size: 22 })}</span>
          <h3>${it.title}</h3>${it.text ? html`<p>${it.text}</p>` : ""}
        </li>`)}
      </ul>`);
    }
    // Interactive showcase: list of features on the left, preview image on the right.
    const items = b.items || [];
    const firstImg = items.find((i) => i.image)?.image;
    return wrap(b, "", html`${head(b)}<div class="showcase" data-showcase>
      <ul class="showcase-list" role="list">
        ${items.map((it, i) => html`<li>
          <button type="button" class="showcase-item" ${it.image ? raw(`data-image="${it.image}"`) : ""} aria-pressed="${i === 0 ? "true" : "false"}">
            <span class="feature-icon">${icon(hasIcon(it.icon) ? it.icon : "dot", { size: 20 })}</span>
            <span><strong>${it.title}</strong>${it.text ? html`<span class="showcase-text">${it.text}</span>` : ""}</span>
          </button>
        </li>`)}
      </ul>
      <div class="showcase-preview" aria-hidden="true">
        <div class="frame">${picture(firstImg, "", { sizes: "(min-width: 960px) 640px, 100vw" })}</div>
      </div>
    </div>`);
  },

  facts: (b) => wrap(b, "", html`${head(b)}<dl class="facts">
    ${(b.items || []).map((it) => html`<div class="fact" data-reveal><dt>${it.label}</dt><dd>${it.value}</dd></div>`)}
  </dl>`),

  gallery: (b) => wrap(b, "", html`${head(b)}${(b.items || []).length
    ? gallery(b.items, { label: b.title })
    : html`<div class="empty-state">${icon("eye", { size: 22 })}<p>${b.emptyText || "Nothing here yet."}</p></div>`}`),

  video: (b) => wrap(b, "", html`${head(b)}${videoFacade({ youtube: b.youtube, poster: b.poster, title: b.title })}${b.caption ? html`<p class="caption">${b.caption}</p>` : ""}`),

  release: (b, p) => {
    const ready = (b.downloads || []).filter((d) => d.url);
    return wrap(b, "", html`<div class="release" data-release data-available="${b.availableFrom || ""}">
      <div class="release-main">
        ${head(b, "")}
        <dl class="release-meta">
          ${b.version ? html`<div><dt>Launcher</dt><dd>v${b.version}</dd></div>` : ""}
          ${b.clientVersion ? html`<div><dt>Client</dt><dd>${b.clientVersion}</dd></div>` : ""}
          ${b.status ? html`<div><dt>Status</dt><dd>${b.status}</dd></div>` : ""}
          ${b.availableFrom ? html`<div><dt>Release</dt><dd>${formatDate(b.availableFrom)}</dd></div>` : ""}
        </dl>
        ${b.requirements ? html`<p class="release-req">${b.requirements}</p>` : ""}
      </div>
      <div class="release-side">
        ${b.availableFrom ? html`<div class="release-wait" data-release-wait>
          <p class="release-when">${icon("clock", { size: 18 })}<span>${b.availableText || `Available from ${formatDate(b.availableFrom)}.`}</span></p>
          <div class="countdown" data-countdown="${b.availableFrom}" hidden>
            <span><b data-d>0</b><small>days</small></span><span><b data-h>0</b><small>hours</small></span><span><b data-m>0</b><small>min</small></span><span><b data-s>0</b><small>sec</small></span>
          </div>
        </div>` : ""}
        <div class="release-downloads" data-release-ready ${b.availableFrom ? raw("hidden") : ""}>
          ${ready.length
            ? html`<ul class="downloads" role="list">${ready.map((d) => html`<li><a class="download" href="${d.url}" ${/^https?:/.test(d.url) ? raw('rel="noopener"') : ""}>
                ${icon("download", { size: 20 })}<span><strong>${d.label}</strong><small>${d.platform}${d.file ? ` · ${d.file}` : ""}${d.size ? ` · ${d.size}` : ""}</small></span></a></li>`)}</ul>`
            : html`<p class="release-pending">${icon("download", { size: 18 })}<span>Download links will be published here at release. Follow the Discord for the announcement.</span></p>`}
        </div>
        ${b.notes ? html`<p class="release-notes">${b.notes}</p>` : ""}
        ${(p.links || []).filter((l) => l.kind === "discord").slice(0, 1).map((l) => button(l.url, l.label, { kind: "ghost", iconName: "discord" }))}
      </div>
    </div>`);
  },

  changelog: (b) => wrap(b, "", html`${head(b)}<ol class="changelog" role="list">
    ${(b.entries || []).map((e) => html`<li class="change" data-reveal>
      <div class="change-head"><span class="change-ver">${e.version}</span>${e.date ? html`<time datetime="${e.date}">${formatDate(e.date)}</time>` : ""}</div>
      ${e.title ? html`<h3>${e.title}</h3>` : ""}
      ${(e.items || []).length ? html`<ul>${e.items.map((x) => html`<li>${x}</li>`)}</ul>` : ""}
    </li>`)}
  </ol>`),

  upcoming: (b) => wrap(b, "", html`${head(b)}
    <ul class="upcoming" role="list">${(b.items || []).map((it) => html`<li data-reveal><span class="planned-tag">Planned</span><h3>${it.title}</h3>${it.text ? html`<p>${it.text}</p>` : ""}</li>`)}</ul>
    ${(b.gallery || []).length ? gallery(b.gallery, { label: `${b.title} preview` }) : ""}`),

  characters: (b) => wrap(b, "", html`${head(b)}<ul class="characters" role="list">
    ${(b.items || []).map((c, i) => html`<li class="character" data-reveal>
      <span class="character-no">${String(i + 1).padStart(2, "0")}</span>
      <h3>${c.name}</h3>${c.role ? html`<p class="character-role">${c.role}</p>` : ""}${c.text ? html`<p>${c.text}</p>` : ""}
    </li>`)}
  </ul>`),

  timeline: (b) => wrap(b, "", html`${head(b)}<ol class="timeline" role="list">
    ${(b.items || []).map((t) => html`<li class="tl-item" data-reveal>
      ${t.label ? html`<span class="tl-label">${t.label}</span>` : ""}
      <div><h3>${t.title}</h3>${t.meta ? html`<p class="tl-meta">${t.meta}</p>` : ""}${t.text ? html`<p>${t.text}</p>` : ""}</div>
    </li>`)}
  </ol>`),

  status: (b) => wrap(b, "", html`<div class="status-grid">${head(b)}
    <ul class="checklist" role="list">${(b.items || []).map((s) => html`<li class="check check-${s.state}" data-reveal>
      <span class="check-mark" aria-hidden="true">${s.state === "done" ? icon("check", { size: 16 }) : ""}</span>
      <span>${s.label}</span>
      <span class="check-state">${{ done: "Complete", spec: "Specified", progress: "In progress", open: "Not started" }[s.state] || s.state}</span>
    </li>`)}</ul></div>`),

  news: (b, p, ctx) => {
    const list = ctx.news.filter((n) => n.project === p.slug).slice(0, b.limit || 3);
    return wrap(b, "", html`<div class="section-row">${head(b)}<a class="text-link" href="/news/">All news ${icon("arrow", { size: 16 })}</a></div>
      ${list.length ? html`<div class="news-grid">${list.map((n) => newsCard(n, ctx))}</div>`
        : html`<div class="empty-state">${icon("news", { size: 22 })}<p>${b.emptyText || "No updates yet."}</p></div>`}`);
  },

  feed: (b, p, ctx) => {
    const entries = ctx.feed || [];
    return wrap(b, "", html`${head(b)}${entries.length ? html`<ol class="changelog" role="list">${entries.map((e) => html`<li class="change">
        <div class="change-head">${e.version ? html`<span class="change-ver">v${e.version}</span>` : ""}${e.date ? html`<time datetime="${e.date}">${formatDate(e.date)}</time>` : ""}</div>
        <h3>${e.title}</h3>${(e.lines || []).length ? html`<ul>${e.lines.map((l) => html`<li>${l}</li>`)}</ul>` : ""}
      </li>`)}</ol>` : html`<div class="empty-state"><p>No in-game news yet.</p></div>`}`);
  },

  placeholder: (b) => wrap(b, "", html`${head(b)}<div class="empty-state placeholder">${icon("clock", { size: 22 })}<p>${b.text || "Coming soon."}</p></div>`),

  cta: (b) => wrap(b, "", html`<div class="cta" data-reveal><div>${b.title ? html`<h2 class="section-title" id="${b.id}-title">${b.title}</h2>` : ""}${b.text ? html`<p>${b.text}</p>` : ""}</div>
    <div class="cta-actions">${(b.links || []).map((l, i) => button(l.url, l.label, { kind: i ? "ghost" : "primary", iconName: linkKindIcon(l.kind) }))}</div></div>`),
};

export function renderBlock(b, project, ctx) {
  const fn = R[b.type];
  return fn ? fn(b, project, ctx) : "";
}
