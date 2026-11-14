// Admin API: POST /api/admin  {action, ...}
//   status                       -> is the admin configured? (no login needed, reveals no secrets)
//   login   {password}           -> {token, expires}
//   load                         -> all content (site, projects, news, in-game feed)
//   save    {kind, data, previousSlug?, uploads?: [{path, base64}]}  -> one commit
//   delete  {kind, slug}         -> one commit
// kind: "site" | "project" | "news" | "feed" | "order" ({slugs}). Every change is validated with the same rules as the build.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   ADMIN_PASSWORD        admin password, at least 10 characters (required)
//   GITHUB_TOKEN          fine-grained token, this repository only, "Contents: Read and write" (already used by /api/news)
//   GITHUB_REPO           e.g. 1fachjonaz/jonaz-productions
//   GITHUB_BRANCH         optional, default "main"
//   ADMIN_SESSION_SECRET  optional extra secret for session tokens
import { validateSite, validateProject, validateNews, validateFeed, SLUG_RE } from "../../shared/schema.mjs";
import { passwordOk, issueToken, tokenOk, adminConfigured } from "./lib/auth.mjs";
import { getStore, assertWritable } from "./lib/store.mjs";

const MAX_BODY = 5.5 * 1024 * 1024;
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (status, error, details) => json(status, { ok: false, error, ...(details ? { details } : {}) });
const serialize = (data) => JSON.stringify(data, null, 2) + "\n";

function parseAll(files) {
  const out = { site: null, projects: [], news: [], feed: { entries: [] } };
  for (const [p, text] of Object.entries(files)) {
    let data;
    try { data = JSON.parse(text); } catch { continue; }
    if (p === "content/site.json") out.site = data;
    else if (p === "quickclient/news.json") out.feed = data;
    else if (p.startsWith("content/projects/")) out.projects.push(data);
    else if (p.startsWith("content/news/")) out.news.push(data);
  }
  out.projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  out.news.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return out;
}

/** Uploaded images must be referenced in the saved content, so nothing unused is committed. */
function checkUploads(uploads, data) {
  if (uploads === undefined) return [];
  if (!Array.isArray(uploads) || uploads.length > 12) throw Object.assign(new Error("Too many uploads (max 12)."), { status: 400 });
  const text = JSON.stringify(data);
  return uploads.map((u) => {
    const p = String(u?.path || "").replace(/^\//, "");
    assertWritable(p);
    if (!p.startsWith("assets/uploads/")) throw Object.assign(new Error("Uploads must go to assets/uploads/."), { status: 400 });
    if (!text.includes("/" + p)) throw Object.assign(new Error(`Upload ${p} is not used in the content.`), { status: 400 });
    const b64 = String(u.base64 || "");
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) throw Object.assign(new Error("Upload data is not base64."), { status: 400 });
    const bytes = Buffer.from(b64, "base64");
    const sig = bytes.subarray(0, 12).toString("latin1");
    const isImage = sig.startsWith("\x89PNG") || (sig.startsWith("RIFF") && sig.slice(8, 12) === "WEBP") || sig.startsWith("\xff\xd8") || sig.startsWith("GIF8");
    if (!isImage) throw Object.assign(new Error(`${p} is not a PNG, WebP, JPEG or GIF image.`), { status: 400 });
    return { path: p, base64: b64 };
  });
}

async function save(store, body) {
  const { kind, data, previousSlug } = body;
  const current = parseAll(await store.readContent());
  const files = [];
  let label;

  if (kind === "site") {
    const errors = validateSite(data);
    if (errors.length) return fail(422, "The site settings are not valid.", errors);
    files.push({ path: "content/site.json", content: serialize(data) });
    label = "site settings";
  } else if (kind === "project") {
    const errors = validateProject(data);
    if (errors.length) return fail(422, "The project is not valid.", errors);
    const clash = current.projects.find((p) => p.slug === data.slug && p.slug !== previousSlug);
    if (clash) return fail(409, `A project with the slug "${data.slug}" already exists.`);
    files.push({ path: `content/projects/${data.slug}.json`, content: serialize(data) });
    if (previousSlug && previousSlug !== data.slug && current.projects.some((p) => p.slug === previousSlug)) {
      if (current.news.some((n) => n.project === previousSlug)) return fail(409, "News articles link to the old slug. Change them first, or keep the slug.");
      files.push({ path: `content/projects/${previousSlug}.json`, delete: true });
    }
    label = `project ${data.name}`;
  } else if (kind === "news") {
    const errors = validateNews(data);
    if (data.project && !current.projects.some((p) => p.slug === data.project)) errors.push(`project "${data.project}" does not exist.`);
    if (errors.length) return fail(422, "The article is not valid.", errors);
    const clash = current.news.find((n) => n.slug === data.slug && n.slug !== previousSlug);
    if (clash) return fail(409, `An article with the slug "${data.slug}" already exists.`);
    files.push({ path: `content/news/${data.slug}.json`, content: serialize(data) });
    if (previousSlug && previousSlug !== data.slug && current.news.some((n) => n.slug === previousSlug)) {
      files.push({ path: `content/news/${previousSlug}.json`, delete: true });
    }
    label = `news: ${data.title}`;
  } else if (kind === "order") {
    const slugs = Array.isArray(data?.slugs) ? data.slugs : [];
    const known = new Set(current.projects.map((p) => p.slug));
    if (slugs.length !== known.size || slugs.some((s) => !known.has(s))) return fail(422, "The order must list every project once.");
    slugs.forEach((slug, i) => {
      const p = current.projects.find((x) => x.slug === slug);
      if (p.order !== i + 1) files.push({ path: `content/projects/${slug}.json`, content: serialize({ ...p, order: i + 1 }) });
    });
    if (!files.length) return json(200, { ok: true, unchanged: true });
    label = "project order";
  } else if (kind === "feed") {
    const errors = validateFeed(data);
    if (errors.length) return fail(422, "The in-game news are not valid.", errors);
    files.push({ path: "quickclient/news.json", content: serialize({ entries: data.entries.slice(0, 30) }) });
    label = "in-game news";
  } else {
    return fail(400, "Unknown content kind.");
  }

  files.push(...checkUploads(body.uploads, data));
  const { sha } = await store.commit(files, `Admin: update ${label}`.slice(0, 120));
  return json(200, { ok: true, commit: sha, storage: store.kind });
}

async function remove(store, { kind, slug }) {
  if (!SLUG_RE.test(String(slug || ""))) return fail(400, "Invalid slug.");
  const current = parseAll(await store.readContent());
  if (kind === "news") {
    if (!current.news.some((n) => n.slug === slug)) return fail(404, "Article not found.");
    await store.commit([{ path: `content/news/${slug}.json`, delete: true }], `Admin: delete news ${slug}`);
  } else if (kind === "project") {
    if (!current.projects.some((p) => p.slug === slug)) return fail(404, "Project not found.");
    if (current.news.some((n) => n.project === slug)) return fail(409, "News articles still link to this project. Change or delete them first.");
    await store.commit([{ path: `content/projects/${slug}.json`, delete: true }], `Admin: delete project ${slug}`);
  } else {
    return fail(400, "Only news and projects can be deleted.");
  }
  return json(200, { ok: true });
}

export default async (req) => {
  if (req.method !== "POST") return fail(405, "Use POST.");
  const length = Number(req.headers.get("content-length") || 0);
  if (length > MAX_BODY) return fail(413, "The request is too large. Use smaller images.");
  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return fail(413, "The request is too large. Use smaller images.");
    body = JSON.parse(text);
  } catch { return fail(400, "Invalid JSON."); }

  const store = getStore();
  if (body.action === "status") return json(200, { ok: true, configured: adminConfigured() && !!store, storage: store?.kind || null });

  if (body.action === "login") {
    if (!adminConfigured()) return fail(503, "The admin is not set up yet: set ADMIN_PASSWORD (10+ characters) in Netlify.");
    if (!passwordOk(body.password)) { await sleep(1500); return fail(401, "Wrong password."); }
    return json(200, { ok: true, ...issueToken() });
  }

  if (!tokenOk(req.headers.get("authorization"))) return fail(401, "Please log in again.");
  if (!store) return fail(503, "Storage is not configured: set GITHUB_TOKEN and GITHUB_REPO in Netlify.");

  try {
    if (body.action === "load") return json(200, { ok: true, storage: store.kind, ...parseAll(await store.readContent()) });
    if (body.action === "save") return await save(store, body);
    if (body.action === "delete") return await remove(store, body);
    return fail(400, "Unknown action.");
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    console.error("admin:", err.message);
    return fail(status, status === 500 ? "Something went wrong on the server." : err.message);
  }
};

export const config = { path: "/api/admin" };
