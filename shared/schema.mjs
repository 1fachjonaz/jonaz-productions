// Content rules shared by the build (fails on invalid content) and the admin API (refuses invalid saves).
// Every function returns a list of error strings; an empty list means the content is valid.

export const CATEGORIES = ["Software", "Minecraft", "Games", "Experimental"];
export const STAGES = ["released", "beta", "in-development", "pre-production", "planned", "legacy"];
export const STAGE_LABELS = {
  released: "Released",
  beta: "Beta",
  "in-development": "In development",
  "pre-production": "Pre-production",
  planned: "Planned",
  legacy: "Legacy",
};
export const THEMES = ["default", "mlbclient", "citylife"];
export const NEWS_CATEGORIES = [
  "Development update",
  "New release",
  "Beta announcement",
  "Project announcement",
  "Changelog",
  "Company news",
];
export const BLOCK_TYPES = [
  "text", "story", "features", "facts", "gallery", "video", "release", "changelog", "upcoming",
  "characters", "timeline", "status", "news", "feed", "placeholder", "cta", "quote",
];

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string";

function checkUrl(errors, where, v, { allowEmpty = true } = {}) {
  if (v === undefined || v === null || v === "") {
    if (!allowEmpty) errors.push(`${where} is required.`);
    return;
  }
  if (!isStr(v)) { errors.push(`${where} must be text.`); return; }
  if (!/^(https?:\/\/|\/|mailto:|#)/.test(v)) errors.push(`${where} must start with https://, / or mailto:.`);
  if (/^javascript:/i.test(v)) errors.push(`${where} is not allowed.`);
}

function checkText(errors, where, v, { required = false, max = 20000 } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) errors.push(`${where} is required.`);
    return;
  }
  if (!isStr(v)) errors.push(`${where} must be text.`);
  else if (v.length > max) errors.push(`${where} is too long (max ${max} characters).`);
}

export function validateSite(site) {
  const e = [];
  if (!isObj(site)) return ["site.json must be an object."];
  checkText(e, "name", site.name, { required: true, max: 80 });
  checkUrl(e, "url", site.url);
  checkText(e, "description", site.description, { required: true, max: 300 });
  if (!isObj(site.hero)) e.push("hero is required.");
  else {
    checkText(e, "hero.headline", site.hero.headline, { required: true, max: 120 });
    checkText(e, "hero.text", site.hero.text, { max: 400 });
  }
  if (site.social !== undefined) {
    if (!Array.isArray(site.social)) e.push("social must be a list.");
    else site.social.forEach((s, i) => {
      checkText(e, `social[${i}].label`, s?.label, { required: true, max: 40 });
      checkUrl(e, `social[${i}].url`, s?.url);
    });
  }
  if (site.contact?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.contact.email)) e.push("contact.email is not a valid address.");
  return e;
}

function validateItems(e, where, items, fields) {
  if (items === undefined) return;
  if (!Array.isArray(items)) { e.push(`${where} must be a list.`); return; }
  items.forEach((it, i) => {
    if (!isObj(it)) { e.push(`${where}[${i}] must be an object.`); return; }
    for (const [k, rule] of Object.entries(fields)) {
      if (rule === "url") checkUrl(e, `${where}[${i}].${k}`, it[k]);
      else if (rule === "url!") checkUrl(e, `${where}[${i}].${k}`, it[k], { allowEmpty: false });
      else checkText(e, `${where}[${i}].${k}`, it[k], { required: rule === "text!", max: 4000 });
    }
  });
}

export function validateBlock(b, i) {
  const e = [];
  const w = `sections[${i}]`;
  if (!isObj(b)) return [`${w} must be an object.`];
  if (!BLOCK_TYPES.includes(b.type)) return [`${w}.type "${b.type}" is unknown. Allowed: ${BLOCK_TYPES.join(", ")}.`];
  if (b.id !== undefined && (!isStr(b.id) || !SLUG_RE.test(b.id))) e.push(`${w}.id must be lowercase letters, numbers and dashes.`);
  checkText(e, `${w}.title`, b.title, { max: 200 });
  checkText(e, `${w}.body`, b.body);
  switch (b.type) {
    case "features":
      validateItems(e, `${w}.items`, b.items, { title: "text!", text: "text", image: "url" });
      break;
    case "facts":
      validateItems(e, `${w}.items`, b.items, { label: "text!", value: "text!" });
      break;
    case "gallery":
      validateItems(e, `${w}.items`, b.items, { src: "url!", alt: "text!", caption: "text" });
      break;
    case "video":
      checkUrl(e, `${w}.youtube`, b.youtube, { allowEmpty: false });
      checkUrl(e, `${w}.poster`, b.poster);
      break;
    case "release":
      validateItems(e, `${w}.downloads`, b.downloads, { label: "text!", platform: "text", url: "url" });
      if (b.availableFrom && Number.isNaN(Date.parse(b.availableFrom))) e.push(`${w}.availableFrom is not a valid date.`);
      break;
    case "changelog":
      validateItems(e, `${w}.entries`, b.entries, { version: "text!", title: "text", date: "text" });
      break;
    case "upcoming":
      validateItems(e, `${w}.items`, b.items, { title: "text!", text: "text" });
      validateItems(e, `${w}.gallery`, b.gallery, { src: "url!", alt: "text!", caption: "text" });
      break;
    case "characters":
      validateItems(e, `${w}.items`, b.items, { name: "text!", role: "text", text: "text" });
      break;
    case "timeline":
      validateItems(e, `${w}.items`, b.items, { title: "text!", meta: "text", label: "text", text: "text" });
      break;
    case "status":
      validateItems(e, `${w}.items`, b.items, { label: "text!", state: "text!" });
      break;
    case "cta":
      validateItems(e, `${w}.links`, b.links, { label: "text!", url: "url!" });
      break;
  }
  return e;
}

export function validateProject(p) {
  const e = [];
  if (!isObj(p)) return ["The project must be an object."];
  if (!isStr(p.slug) || !SLUG_RE.test(p.slug)) e.push("slug must be lowercase letters, numbers and dashes.");
  checkText(e, "name", p.name, { required: true, max: 80 });
  if (!CATEGORIES.includes(p.category)) e.push(`category must be one of: ${CATEGORIES.join(", ")}.`);
  if (!THEMES.includes(p.theme || "default")) e.push(`theme must be one of: ${THEMES.join(", ")}.`);
  if (!isObj(p.status) || !STAGES.includes(p.status.stage)) e.push(`status.stage must be one of: ${STAGES.join(", ")}.`);
  else checkText(e, "status.label", p.status.label, { max: 80 });
  checkText(e, "tagline", p.tagline, { max: 160 });
  checkText(e, "summary", p.summary, { required: true, max: 400 });
  checkText(e, "description", p.description, { max: 4000 });
  if (p.tags !== undefined && (!Array.isArray(p.tags) || p.tags.some((t) => !isStr(t) || t.length > 40))) e.push("tags must be a list of short texts.");
  if (typeof p.featured !== "boolean") e.push("featured must be true or false.");
  if (typeof p.order !== "number" || !Number.isFinite(p.order)) e.push("order must be a number.");
  checkUrl(e, "logo", p.logo);
  checkUrl(e, "icon", p.icon);
  checkUrl(e, "cover", p.cover);
  validateItems(e, "links", p.links, { label: "text!", url: "url!" });
  if (p.hero?.trailer) checkUrl(e, "hero.trailer", p.hero.trailer);
  if (p.sections !== undefined) {
    if (!Array.isArray(p.sections)) e.push("sections must be a list.");
    else p.sections.forEach((b, i) => e.push(...validateBlock(b, i)));
  }
  return e;
}

export function validateNews(n) {
  const e = [];
  if (!isObj(n)) return ["The article must be an object."];
  if (!isStr(n.slug) || !SLUG_RE.test(n.slug)) e.push("slug must be lowercase letters, numbers and dashes.");
  checkText(e, "title", n.title, { required: true, max: 140 });
  if (!isStr(n.date) || !DATE_RE.test(n.date) || Number.isNaN(Date.parse(n.date))) e.push("date must be YYYY-MM-DD.");
  if (!NEWS_CATEGORIES.includes(n.category)) e.push(`category must be one of: ${NEWS_CATEGORIES.join(", ")}.`);
  checkText(e, "excerpt", n.excerpt, { max: 400 });
  checkText(e, "body", n.body, { required: true, max: 60000 });
  checkUrl(e, "cover", n.cover);
  if (n.project !== undefined && n.project !== "" && (!isStr(n.project) || !SLUG_RE.test(n.project))) e.push("project must be a project slug or empty.");
  if (typeof n.published !== "boolean") e.push("published must be true or false.");
  if (n.pinned !== undefined && typeof n.pinned !== "boolean") e.push("pinned must be true or false.");
  return e;
}

/** QuickClient / MLBClient in-game feed (quickclient/news.json), read by the mods. */
export function validateFeed(f) {
  const e = [];
  if (!isObj(f) || !Array.isArray(f.entries)) return ["The feed must be {\"entries\": [...]}"];
  f.entries.forEach((x, i) => {
    checkText(e, `entries[${i}].title`, x?.title, { required: true, max: 80 });
    if (x?.lines !== undefined && (!Array.isArray(x.lines) || x.lines.some((l) => !isStr(l)))) e.push(`entries[${i}].lines must be a list of texts.`);
  });
  return e;
}
