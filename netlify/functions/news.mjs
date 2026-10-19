// QuickClient news endpoint: POST /api/news with {password, version, title, lines}.
// The password and the GitHub token live only in Netlify's environment variables - never in the mod or the site.
//
// Environment variables (Netlify > Site configuration > Environment variables):
//   NEWS_PASSWORD   the password you type in game (/qcnews)
//   GITHUB_TOKEN    fine-grained token, this repository only, "Contents: Read and write"
//   GITHUB_REPO     e.g. YourName/jonaz-productions
//   GITHUB_BRANCH   optional, default "main"
//   NEWS_PATH       optional, default "quickclient/news.json"
import { createHash, timingSafeEqual } from "node:crypto";

const MAX_ENTRIES = 30;
const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const digest = s => createHash("sha256").update(String(s), "utf8").digest();

function passwordOk(given) {
  const expected = process.env.NEWS_PASSWORD || "";
  if (!expected) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

function clean(s, max) {
  return String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST." });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: "Invalid JSON." }); }

  if (!passwordOk(body.password)) {
    await sleep(1500); // slows down guessing
    return json(401, { ok: false, error: "Wrong password." });
  }

  const title = clean(body.title, 80);
  if (!title) return json(400, { ok: false, error: "Title is missing." });
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .map(l => clean(l, 200).replace(/^[-*•]\s*/, "")).filter(Boolean).slice(0, 20);
  const entry = {
    id: "game-" + Date.now(),
    version: clean(body.version, 20).replace(/^v/i, ""),
    date: new Date().toISOString().slice(0, 10),
    title,
    lines,
  };

  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return json(500, { ok: false, error: "Server is not configured." });
  const branch = process.env.GITHUB_BRANCH || "main";
  const path = process.env.NEWS_PATH || "quickclient/news.json";
  const url = `https://api.github.com/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "jonaz-productions-news",
  };

  // Two tries in case the file changed between read and write.
  for (let attempt = 0; attempt < 2; attempt++) {
    let entries = [];
    let sha;
    const get = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
    if (get.ok) {
      const data = await get.json();
      sha = data.sha;
      try {
        const parsed = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
        if (Array.isArray(parsed.entries)) entries = parsed.entries;
      } catch { /* broken file: start a new list */ }
    } else if (get.status !== 404) {
      return json(502, { ok: false, error: `GitHub read failed (${get.status}).` });
    }
    const content = JSON.stringify({ entries: [entry, ...entries].slice(0, MAX_ENTRIES) }, null, 2) + "\n";
    const put = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        message: `News from Minecraft: ${title}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (put.ok) return json(200, { ok: true, entry });
    if (put.status !== 409 && put.status !== 422) {
      return json(502, { ok: false, error: `GitHub write failed (${put.status}).` });
    }
  }
  return json(409, { ok: false, error: "The news file was busy, try again." });
};

export const config = { path: "/api/news" };
