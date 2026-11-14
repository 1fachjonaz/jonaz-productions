import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let dir, handler, token;
const call = async (body, auth = token) => {
  const res = await handler(new Request("http://x/api/admin", { method: "POST", headers: auth ? { authorization: `Bearer ${auth}` } : {}, body: JSON.stringify(body) }));
  return { status: res.status, body: await res.json() };
};
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64").toString("base64");

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "jp-admin-"));
  for (const d of ["content", "quickclient"]) await cp(path.resolve(d), path.join(dir, d), { recursive: true });
  process.env.ADMIN_LOCAL_DIR = dir;
  process.env.ADMIN_PASSWORD = "test-password-123";
  handler = (await import("../netlify/functions/admin.mjs")).default;
});

test("login: wrong password is refused, right one gives a token", async () => {
  assert.equal((await call({ action: "login", password: "nope" }, "")).status, 401);
  const r = await call({ action: "login", password: "test-password-123" }, "");
  assert.equal(r.status, 200);
  token = r.body.token;
});

test("protected actions need a valid token", async () => {
  assert.equal((await call({ action: "load" }, "")).status, 401);
  assert.equal((await call({ action: "load" }, token.replace(/.$/, "x"))).status, 401);
  assert.equal((await call({ action: "load" }, "1000000000000." + token.split(".")[1])).status, 401);
  const r = await call({ action: "load" });
  assert.equal(r.status, 200);
  assert.ok(r.body.projects.length >= 3);
});

test("weak passwords are never accepted", async () => {
  process.env.ADMIN_PASSWORD = "short";
  assert.equal((await call({ action: "login", password: "short" }, "")).status, 503);
  process.env.ADMIN_PASSWORD = "test-password-123";
});

test("save news with an upload, rename it, delete it", async () => {
  const article = { slug: "t1", title: "Test", date: "2026-11-14", category: "Changelog", project: "mlbclient", cover: "/assets/uploads/2026/t1-abc.png", excerpt: "e", body: "b", published: true };
  let r = await call({ action: "save", kind: "news", data: article, uploads: [{ path: "assets/uploads/2026/t1-abc.png", base64: PNG }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(existsSync(path.join(dir, "content/news/t1.json")));
  assert.ok(existsSync(path.join(dir, "assets/uploads/2026/t1-abc.png")));
  r = await call({ action: "save", kind: "news", data: { ...article, slug: "t2" }, previousSlug: "t1" });
  assert.equal(r.status, 200);
  assert.ok(!existsSync(path.join(dir, "content/news/t1.json")) && existsSync(path.join(dir, "content/news/t2.json")));
  assert.equal((await call({ action: "delete", kind: "news", slug: "t2" })).status, 200);
  assert.ok(!existsSync(path.join(dir, "content/news/t2.json")));
});

test("invalid content, unused or fake uploads and path tricks are refused", async () => {
  const bad = await call({ action: "save", kind: "news", data: { slug: "x", title: "" } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.details.length);
  const article = { slug: "t3", title: "T", date: "2026-11-14", category: "Changelog", body: "b", published: true };
  assert.equal((await call({ action: "save", kind: "news", data: article, uploads: [{ path: "assets/uploads/2026/unused.png", base64: PNG }] })).status, 400);
  assert.equal((await call({ action: "save", kind: "news", data: { ...article, cover: "/assets/uploads/2026/a.png" }, uploads: [{ path: "assets/uploads/2026/a.png", base64: Buffer.from("<html>").toString("base64") }] })).status, 400);
  assert.equal((await call({ action: "save", kind: "news", data: { ...article, cover: "/netlify/functions/x.mjs" }, uploads: [{ path: "netlify/functions/x.mjs", base64: PNG }] })).status, 400);
  assert.equal((await call({ action: "save", kind: "news", data: { ...article, project: "does-not-exist" } })).status, 422);
  assert.equal((await call({ action: "delete", kind: "news", slug: "../site" })).status, 400);
  assert.equal((await call({ action: "delete", kind: "project", slug: "mlbclient" })).status, 409, "news still link to it");
});

test("projects: feature toggle, status change and reorder", async () => {
  const { body } = await call({ action: "load" });
  const qc = body.projects.find((p) => p.slug === "quickclient");
  assert.equal((await call({ action: "save", kind: "project", data: { ...qc, featured: true, status: { stage: "legacy", label: "" } }, previousSlug: "quickclient" })).status, 200);
  const saved = JSON.parse(await readFile(path.join(dir, "content/projects/quickclient.json"), "utf8"));
  assert.equal(saved.featured, true);
  assert.equal(saved.status.stage, "legacy");
  assert.equal((await call({ action: "save", kind: "order", data: { slugs: ["quickclient", "mlbclient", "operation-iron-veil"] } })).status, 200);
  assert.equal(JSON.parse(await readFile(path.join(dir, "content/projects/quickclient.json"), "utf8")).order, 1);
  assert.equal((await call({ action: "save", kind: "order", data: { slugs: ["quickclient"] } })).status, 422);
});

test("in-game feed keeps the format the mods read", async () => {
  assert.equal((await call({ action: "save", kind: "feed", data: { entries: [{ version: "0.1.0", date: "2026-11-15", title: "Hello", lines: ["a"] }] } })).status, 200);
  const feed = JSON.parse(await readFile(path.join(dir, "quickclient/news.json"), "utf8"));
  assert.deepEqual(Object.keys(feed), ["entries"]);
  assert.equal(feed.entries[0].title, "Hello");
});
