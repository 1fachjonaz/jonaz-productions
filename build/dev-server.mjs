#!/usr/bin/env node
// Local development server: builds the site, serves dist/, runs the admin API against your local files
// (no GitHub needed) and rebuilds after every admin save or content change.
//   npm run dev            -> http://localhost:8888  (admin: /admin/, password from ADMIN_PASSWORD or "local-admin-password")
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { watch, existsSync, readFileSync } from "node:fs";
const readFileSyncText = (f) => readFileSync(f, "utf8");
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 8888);
process.env.ADMIN_LOCAL_DIR ||= ROOT;
process.env.ADMIN_PASSWORD ||= "local-admin-password";

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".woff2": "font/woff2", ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".jar": "application/java-archive" };

/** Applies the [[headers]] rules from netlify.toml locally, so CSP problems show up during development. */
const HEADER_RULES = (() => {
  const toml = existsSync(path.join(ROOT, "netlify.toml")) ? readFileSyncText(path.join(ROOT, "netlify.toml")) : "";
  return toml.split("[[headers]]").slice(1).map((block) => {
    const pattern = (block.match(/for\s*=\s*"([^"]+)"/) || [])[1] || "";
    const values = {};
    for (const m of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)) if (m[1] !== "for") values[m[1]] = m[2];
    const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return { re, values };
  });
})();
function headersFor(p) {
  const out = {};
  for (const r of HEADER_RULES) if (r.re.test(p)) Object.assign(out, r.values);
  return out;
}

function build() {
  const r = spawnSync(process.execPath, [path.join(ROOT, "build/build.mjs")], { stdio: "inherit" });
  return r.status === 0;
}

let timer;
const rebuildSoon = () => { clearTimeout(timer); timer = setTimeout(build, 150); };

const functions = {
  "/api/admin": () => import("../netlify/functions/admin.mjs"),
  "/api/news": () => import("../netlify/functions/news.mjs"),
};

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
}

async function send(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (functions[url.pathname]) {
      const mod = await functions[url.pathname]();
      const response = await mod.default(await toRequest(req));
      await send(res, response);
      if (url.pathname === "/api/admin" && req.method === "POST" && response.ok) rebuildSoon();
      return;
    }
    if (req.method === "POST") {
      // Netlify Forms are only available on Netlify; locally the submission is accepted and printed.
      const r = await toRequest(req);
      console.log("[form]", Object.fromEntries(new URLSearchParams(await r.text())));
      res.writeHead(200, { "content-type": "text/plain" });
      return res.end("ok");
    }
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (existsSync(file) && (await stat(file)).isDirectory()) file = path.join(file, "index.html");
    if (!existsSync(file)) {
      if (url.pathname.startsWith("/quickclient") && !url.pathname.endsWith(".json")) { res.writeHead(301, { location: "/projects/quickclient/" }); return res.end(); }
      res.writeHead(404, { "content-type": MIME[".html"], ...headersFor("/404.html") });
      return res.end(await readFile(path.join(DIST, "404.html")));
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", ...headersFor(url.pathname), "cache-control": "no-cache" });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end("Server error");
  }
});

if (!build()) process.exit(1);
for (const dir of ["content", "assets", "src", "shared", "admin", "quickclient"]) {
  if (existsSync(path.join(ROOT, dir))) watch(path.join(ROOT, dir), { recursive: true }, rebuildSoon).on("error", () => {});
}
server.listen(PORT, () => {
  console.log(`\n  MOONCREST GROUP dev server: http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin/  (password: ${process.env.ADMIN_PASSWORD === "local-admin-password" ? "local-admin-password" : "from ADMIN_PASSWORD"})`);
  console.log("  Admin saves write directly into this folder.\n");
});
