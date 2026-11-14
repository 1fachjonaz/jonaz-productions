#!/usr/bin/env node
// Builds the static website from content/ into dist/. No dependencies: Node 20+ only.
//   node build/build.mjs            build into dist/
//   node build/build.mjs --check    only validate content (exit code 1 on errors)
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSite, validateProject, validateNews, validateFeed, STAGE_LABELS } from "../shared/schema.mjs";
import { escapeHtml } from "../shared/markdown.mjs";
import { ASSET_VERSION, absUrl } from "../src/templates/layout.mjs";
import * as P from "../src/templates/pages.mjs";
import { IMAGE_SIZES } from "../src/templates/components.mjs";
import { imageSize } from "./image-size.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CHECK_ONLY = process.argv.includes("--check");

const readJson = async (file) => {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (err) { throw new Error(`${path.relative(ROOT, file)}: ${err.message}`); }
};

async function readDir(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  return Promise.all(files.map(async (f) => ({ file: f, data: await readJson(path.join(dir, f)) })));
}

/** Every "/assets/..." or "/downloads/..." path used in content must exist, so no image or link is broken. */
function localRefs(value, out = []) {
  if (typeof value === "string") {
    if (/^\/(assets|downloads)\//.test(value)) out.push(value.split(/[?#]/)[0]);
    for (const m of value.matchAll(/\]\((\/(?:assets|downloads)\/[^)\s]+)/g)) out.push(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => localRefs(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => localRefs(v, out));
  return out;
}

export async function loadContent() {
  const errors = [];
  const site = await readJson(path.join(ROOT, "content/site.json"));
  validateSite(site).forEach((e) => errors.push(`content/site.json: ${e}`));

  const projects = [];
  for (const { file, data } of await readDir(path.join(ROOT, "content/projects"))) {
    const errs = validateProject(data);
    errs.forEach((e) => errors.push(`content/projects/${file}: ${e}`));
    if (!errs.length && data.slug + ".json" !== file) errors.push(`content/projects/${file}: file name must be "${data.slug}.json".`);
    data.status.stageLabel = STAGE_LABELS[data.status?.stage];
    projects.push(data);
  }
  projects.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const allNews = [];
  for (const { file, data } of await readDir(path.join(ROOT, "content/news"))) {
    const errs = validateNews(data);
    errs.forEach((e) => errors.push(`content/news/${file}: ${e}`));
    if (!errs.length && data.slug + ".json" !== file) errors.push(`content/news/${file}: file name must be "${data.slug}.json".`);
    if (data.project && !projects.some((p) => p.slug === data.project)) errors.push(`content/news/${file}: project "${data.project}" does not exist.`);
    allNews.push(data);
  }
  const news = allNews.filter((n) => n.published).sort((a, b) => (b.pinned === true) - (a.pinned === true) || b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  let feed = [];
  const feedFile = path.join(ROOT, "quickclient/news.json");
  if (existsSync(feedFile)) {
    const f = await readJson(feedFile);
    validateFeed(f).forEach((e) => errors.push(`quickclient/news.json: ${e}`));
    feed = f.entries || [];
  }

  for (const [where, obj] of [["content/site.json", site], ...projects.map((p) => [`content/projects/${p.slug}.json`, p]), ...allNews.map((n) => [`content/news/${n.slug}.json`, n])]) {
    for (const ref of new Set(localRefs(obj))) {
      if (!existsSync(path.join(ROOT, decodeURIComponent(ref)))) errors.push(`${where}: file ${ref} does not exist.`);
    }
  }
  return { site, projects, news, feed, errors };
}

async function collectImageSizes(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectImageSizes(full);
    else if (/\.(png|webp|jpe?g)$/i.test(entry.name)) {
      try { const s = imageSize(full); if (s) IMAGE_SIZES.set("/" + path.relative(ROOT, full).split(path.sep).join("/"), s); } catch { /* unreadable image: no size */ }
    }
  }
}

async function write(rel, content) {
  const file = path.join(DIST, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function hashFiles(files) {
  const h = createHash("sha256");
  for (const f of files) h.update(await readFile(path.join(ROOT, f)));
  return h.digest("hex").slice(0, 10);
}

function sitemap(ctx) {
  const urls = ["/", "/projects/", "/news/", "/about/", "/contact/", "/legal/",
    ...ctx.projects.map((p) => `/projects/${p.slug}/`), ...ctx.news.map((n) => `/news/${n.slug}/`)];
  const last = new Map(ctx.news.map((n) => [`/news/${n.slug}/`, n.date]));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${escapeHtml(absUrl(ctx.site, u))}</loc>${last.has(u) ? `<lastmod>${last.get(u)}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

function rss(ctx) {
  const items = ctx.news.slice(0, 30).map((n) => `  <item>
    <title>${escapeHtml(n.title)}</title>
    <link>${escapeHtml(absUrl(ctx.site, `/news/${n.slug}/`))}</link>
    <guid>${escapeHtml(absUrl(ctx.site, `/news/${n.slug}/`))}</guid>
    <pubDate>${new Date(n.date + "T12:00:00Z").toUTCString()}</pubDate>
    <category>${escapeHtml(n.category)}</category>
    <description>${escapeHtml(n.excerpt || "")}</description>
  </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>${escapeHtml(ctx.site.name)} News</title>\n  <link>${escapeHtml(absUrl(ctx.site, "/news/"))}</link>\n  <description>${escapeHtml(ctx.site.description)}</description>\n  <language>en</language>\n${items}\n</channel></rss>\n`;
}

async function main() {
  const t0 = Date.now();
  const ctx = await loadContent();
  if (ctx.errors.length) {
    console.error(`\nContent errors (${ctx.errors.length}):\n` + ctx.errors.map((e) => "  - " + e).join("\n") + "\n");
    process.exit(1);
  }
  if (CHECK_ONLY) { console.log("Content OK."); return; }

  // Hosting: the same code runs on Vercel and on Netlify.
  //  - Site URL for canonical links, sitemap and sharing: SITE_URL, else the host's production URL, else content/site.json.
  //  - Contact form: Netlify Forms on Netlify; on Vercel the /api/contact function (needs CONTACT_WEBHOOK_URL).
  const env = process.env;
  const hostUrl = env.VERCEL ? (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`) : env.NETLIFY ? env.URL : "";
  ctx.site.url = env.SITE_URL || hostUrl || ctx.site.url;
  ctx.hosting = {
    name: env.VERCEL ? "vercel" : env.NETLIFY ? "netlify" : "local",
    contactEndpoint: env.VERCEL ? "/api/contact" : "/",
    contactAvailable: !env.VERCEL || !!env.CONTACT_WEBHOOK_URL,
  };

  await collectImageSizes(path.join(ROOT, "assets"));
  ASSET_VERSION.v = await hashFiles(["assets/css/site.css", "assets/js/site.js"]);
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Static files
  await cp(path.join(ROOT, "assets"), path.join(DIST, "assets"), { recursive: true });
  for (const dir of ["downloads", "admin"]) {
    if (existsSync(path.join(ROOT, dir))) await cp(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
  }
  // The admin uses the same Markdown renderer and validation rules as the build.
  for (const f of ["markdown.mjs", "schema.mjs"]) await cp(path.join(ROOT, "shared", f), path.join(DIST, "admin", f));
  await mkdir(path.join(DIST, "quickclient"), { recursive: true });
  if (existsSync(path.join(ROOT, "quickclient/news.json"))) await cp(path.join(ROOT, "quickclient/news.json"), path.join(DIST, "quickclient/news.json"));

  // Pages
  await write("index.html", P.homePage(ctx));
  await write("projects/index.html", P.projectsPage(ctx));
  for (const p of ctx.projects) await write(`projects/${p.slug}/index.html`, P.projectPage(p, ctx));
  await write("news/index.html", P.newsIndexPage(ctx));
  for (const n of ctx.news) await write(`news/${n.slug}/index.html`, P.articlePage(n, ctx));
  await write("about/index.html", P.aboutPage(ctx));
  await write("contact/index.html", P.contactPage(ctx));
  await write("contact/thanks/index.html", P.thanksPage(ctx));
  await write("legal/index.html", P.legalPage(ctx));
  await write("404.html", P.notFoundPage(ctx));

  // SEO + hosting files
  await write("sitemap.xml", sitemap(ctx));
  await write("news/feed.xml", rss(ctx));
  await write("robots.txt", `User-agent: *\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ${absUrl(ctx.site, "/sitemap.xml")}\n`);
  await write("_redirects", [
    "# Old QuickClient page (the in-game feed quickclient/news.json stays where it is)",
    "/quickclient /projects/quickclient/ 301",
    "/quickclient/ /projects/quickclient/ 301",
    "/quickclient/index.html /projects/quickclient/ 301",
    "",
  ].join("\n"));

  const pages = 9 + ctx.projects.length + ctx.news.length;
  console.log(`Hosting: ${ctx.hosting.name} · site URL: ${ctx.site.url} · contact form: ${ctx.hosting.contactAvailable ? ctx.hosting.contactEndpoint : "off (set CONTACT_WEBHOOK_URL)"}`);
  console.log(`Built ${pages} pages (${ctx.projects.length} projects, ${ctx.news.length} articles) in ${Date.now() - t0} ms -> dist/`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("build.mjs")) {
  main().catch((err) => { console.error(err.stack || err.message); process.exit(1); });
}
