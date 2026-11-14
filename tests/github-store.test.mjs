// The production storage talks to the GitHub Git Data API. This test runs it against a small in-memory fake.
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeGitHub(files) {
  let n = 0;
  const blobs = new Map(); const trees = new Map(); const commits = new Map();
  const id = (p) => `${p}${++n}`.padEnd(40, "0");
  const mkTree = (map) => { const t = id("t"); trees.set(t, new Map(map)); return t; };
  const root = id("c"); commits.set(root, { tree: mkTree(Object.entries(files).map(([p, c]) => { const b = id("b"); blobs.set(b, c); return [p, b]; })) });
  let head = root; const calls = [];
  const fetch = async (url, init = {}) => {
    const u = new URL(url); const p = u.pathname.replace(/^\/repos\/o\/r/, ""); const m = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null; calls.push(`${m} ${p}`);
    assert.equal(init.headers.authorization, "Bearer tok");
    const ok = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
    if (m === "GET" && p === "/git/ref/heads/main") return ok({ object: { sha: head } });
    if (m === "GET" && p.startsWith("/git/commits/")) return ok({ tree: { sha: commits.get(p.split("/").pop()).tree } });
    if (m === "GET" && p.startsWith("/git/trees/")) return ok({ tree: [...trees.get(p.split("/").pop()).entries()].map(([path, sha]) => ({ path, sha, type: "blob" })) });
    if (m === "GET" && p.startsWith("/git/blobs/")) return ok({ content: Buffer.from(blobs.get(p.split("/").pop())).toString("base64") });
    if (m === "POST" && p === "/git/blobs") { const b = id("b"); blobs.set(b, body.encoding === "base64" ? Buffer.from(body.content, "base64").toString("latin1") : body.content); return ok({ sha: b }, 201); }
    if (m === "POST" && p === "/git/trees") { const t = new Map(trees.get(body.base_tree)); for (const e of body.tree) e.sha === null ? t.delete(e.path) : t.set(e.path, e.sha); const s = id("t"); trees.set(s, t); return ok({ sha: s }, 201); }
    if (m === "POST" && p === "/git/commits") { const c = id("c"); commits.set(c, { tree: body.tree, message: body.message }); return ok({ sha: c }, 201); }
    if (m === "PATCH" && p === "/git/refs/heads/main") { head = body.sha; return ok({}); }
    return new Response("{}", { status: 404 });
  };
  return { fetch, calls, files: () => Object.fromEntries([...trees.get(commits.get(head).tree)].map(([p, b]) => [p, blobs.get(b)])), message: () => commits.get(head).message };
}

test("GitHub store reads content and writes all files in one commit", async () => {
  const gh = fakeGitHub({ "content/site.json": '{"a":1}', "content/news/a.json": "{}", "README.md": "x", "quickclient/news.json": '{"entries":[]}' });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => gh.fetch(url.replace("https://api.github.com", "http://gh"), init);
  try {
    delete process.env.ADMIN_LOCAL_DIR;
    Object.assign(process.env, { GITHUB_REPO: "o/r", GITHUB_TOKEN: "tok", GITHUB_BRANCH: "main" });
    const { getStore } = await import(`../netlify/functions/lib/store.mjs?${Date.now()}`);
    const store = getStore();
    assert.equal(store.kind, "github");
    const content = await store.readContent();
    assert.deepEqual(Object.keys(content).sort(), ["content/news/a.json", "content/site.json", "quickclient/news.json"]);
    await store.commit([
      { path: "content/news/b.json", content: '{"b":1}' },
      { path: "content/news/a.json", delete: true },
      { path: "assets/uploads/2026/x.png", base64: Buffer.from("\x89PNG").toString("base64") },
    ], "Admin: test");
    const after = gh.files();
    assert.equal(after["content/news/b.json"], '{"b":1}');
    assert.ok(!("content/news/a.json" in after));
    assert.ok("assets/uploads/2026/x.png" in after);
    assert.equal(after["README.md"], "x");
    assert.equal(gh.message(), "Admin: test");
    assert.equal(gh.calls.filter((c) => c.startsWith("PATCH")).length, 1, "exactly one commit");
    await assert.rejects(store.commit([{ path: "netlify.toml", content: "x" }], "bad"), /not allowed/);
  } finally { globalThis.fetch = realFetch; }
});
