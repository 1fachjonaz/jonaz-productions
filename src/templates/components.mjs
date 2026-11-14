import { html, raw } from "./html.mjs";
import { icon } from "./icons.mjs";
import { STAGE_LABELS } from "../../shared/schema.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`;
}

export function statusBadge(status) {
  const stage = status?.stage || "planned";
  return html`<span class="status status-${stage}"><span class="status-dot" aria-hidden="true"></span>${status?.label || STAGE_LABELS[stage]}</span>`;
}

export function button(href, label, { kind = "primary", iconName = "", external = /^https?:/.test(href), attrs = "" } = {}) {
  const ext = external ? raw(' target="_blank" rel="noopener noreferrer"') : "";
  return html`<a class="btn btn-${kind}" href="${href}"${ext} ${raw(attrs)}>${iconName ? icon(iconName, { size: 18 }) : ""}<span>${label}</span>${external && kind !== "icon" ? icon("external", { size: 14, cls: "btn-ext" }) : ""}</a>`;
}

export function linkKindIcon(kind) {
  return { discord: "discord", website: "globe", download: "download", youtube: "youtube", github: "github" }[kind] || "arrow";
}

/** Real image sizes, filled by the build (prevents layout shift). */
export const IMAGE_SIZES = new Map();

export function picture(src, alt, { cls = "", sizes = "100vw", eager = false } = {}) {
  if (!src) return "";
  const { width = 1600, height = 900 } = IMAGE_SIZES.get(src) || {};
  const m = src.match(/^(\/assets\/img\/.+)\.webp$/);
  const srcset = m && IMAGE_SIZES.has(`${m[1]}-800.webp`) ? `${m[1]}-800.webp 800w, ${src} ${width}w` : "";
  return html`<img class="${cls}" src="${src}" ${srcset ? raw(`srcset="${srcset}" sizes="${sizes}"`) : ""} alt="${alt || ""}" width="${width}" height="${height}" ${raw(eager ? 'fetchpriority="high"' : 'loading="lazy"')} decoding="async">`;
}

/** Visual for a project card: the cover image, or a themed tile with the logo when there is no cover. */
export function projectMedia(p, { eager = false } = {}) {
  if (p.cover) return html`<div class="pmedia">${picture(p.cover, p.coverAlt || "", { sizes: "(min-width: 960px) 560px, 100vw", eager })}</div>`;
  return html`<div class="pmedia pmedia-tile tile-${p.theme || "default"}">${p.logo ? html`<img src="${p.logo}" alt="" class="pmedia-logo" loading="lazy">` : html`<span>${p.name}</span>`}</div>`;
}

export function projectCard(p, { large = false, eager = false } = {}) {
  return html`<article class="pcard ${large ? "pcard-lg" : ""} pcard-${p.theme || "default"}" data-category="${p.category}" data-reveal>
    <a class="pcard-link" href="/projects/${p.slug}/" aria-label="${p.name}: open project page"></a>
    ${projectMedia(p, { eager })}
    <div class="pcard-body">
      <div class="pcard-head">
        ${p.icon || p.logo ? html`<img class="pcard-logo" src="${p.icon || p.logo}" alt="" width="40" height="40" loading="lazy">` : ""}
        <div>
          <p class="pcard-cat">${p.category}</p>
          <h3 class="pcard-title">${p.name}</h3>
        </div>
      </div>
      <p class="pcard-text">${p.summary}</p>
      <div class="pcard-meta">
        ${statusBadge(p.status)}
        ${(p.tags || []).slice(0, large ? 4 : 3).map((t) => html`<span class="tag">${t}</span>`)}
      </div>
      <span class="pcard-more">View project ${icon("arrow", { size: 16 })}</span>
    </div>
  </article>`;
}

export function newsCard(n, ctx, { compact = false } = {}) {
  const project = n.project ? ctx.projects.find((p) => p.slug === n.project) : null;
  return html`<article class="ncard ${compact ? "ncard-compact" : ""}" data-category="${n.category}" data-reveal>
    <a class="ncard-link" href="/news/${n.slug}/" aria-label="${n.title}"></a>
    <div class="ncard-media ${n.cover ? "" : `ncard-fallback fb-${project?.theme || "studio"}`}">
      ${n.cover ? picture(n.cover, n.coverAlt || "", { sizes: "(min-width: 960px) 380px, 100vw" }) : html`<img src="${project?.icon || project?.logo || "/assets/img/brand/mark.svg"}" alt="" loading="lazy">`}
    </div>
    <div class="ncard-body">
      <p class="meta"><span class="ncat">${n.category}</span><time datetime="${n.date}">${formatDate(n.date)}</time></p>
      <h3 class="ncard-title">${n.title}</h3>
      ${compact ? "" : html`<p class="ncard-text">${n.excerpt}</p>`}
    </div>
  </article>`;
}

export function sectionHead({ eyebrow, title, intro, id, level = 2 }) {
  const tag = raw(`h${level}`);
  return html`<header class="section-head">
    ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ""}
    ${title ? html`<${tag} class="section-title"${id ? raw(` id="${id}-title"`) : ""}>${title}</${tag}>` : ""}
    ${intro ? html`<p class="section-intro">${intro}</p>` : ""}
  </header>`;
}

export function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : "";
}

export function videoFacade({ youtube, poster, title }) {
  const id = youtubeId(youtube);
  if (!id) return "";
  return html`<div class="video" data-video="${id}" data-title="${title || "Video"}">
    ${poster ? picture(poster, "", { cls: "video-poster" }) : ""}
    <button type="button" class="video-play" aria-label="Play video: ${title || "Video"}">${icon("play", { size: 30 })}</button>
    <p class="video-note">Plays from YouTube (youtube-nocookie.com) after you click. <a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
  </div>`;
}
