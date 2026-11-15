import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, safeUrl, plainText } from "../shared/markdown.mjs";
import { validateNews, validateProject, validateSite, validateFeed } from "../shared/schema.mjs";
import { loadContent } from "../build/build.mjs";

test("markdown escapes HTML and blocks dangerous URLs", () => {
  const out = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1)) ![a](" onerror="x)');
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
  assert.ok(!/href="javascript:/i.test(out));
  assert.equal(safeUrl("javascript:alert(1)"), "#");
  assert.equal(safeUrl("https://a.b/c"), "https://a.b/c");
  assert.equal(safeUrl("/assets/x.webp"), "/assets/x.webp");
});

test("markdown renders the supported syntax", () => {
  const out = renderMarkdown("## Title\n\n**b** *i* `c`\n\n- a\n- b\n\n1. x\n\n> q\n\n![alt](/assets/a.webp \"cap\")");
  for (const s of ["<h2>Title</h2>", "<strong>b</strong>", "<em>i</em>", "<code>c</code>", "<ul><li>a</li><li>b</li></ul>", "<ol><li>x</li></ol>", "<blockquote>", "<figcaption>cap</figcaption>"]) assert.ok(out.includes(s), s);
  assert.equal(plainText("## Hi **there** [link](https://x)"), "Hi there link");
});

test("schema rejects invalid content", () => {
  assert.ok(validateNews({}).length > 3);
  assert.ok(validateNews({ slug: "Bad Slug", title: "t", date: "2026-13-45", category: "x", body: "b", published: true }).length >= 3);
  assert.deepEqual(validateNews({ slug: "ok", title: "t", date: "2026-11-14", category: "Changelog", body: "b", published: false }), []);
  const errs = validateProject({ slug: "p", name: "P", category: "Games", status: { stage: "beta" }, summary: "s", featured: true, order: 1, sections: [{ type: "release", downloads: [{ label: "x", url: "javascript:alert(1)" }] }] });
  assert.ok(errs.some((e) => e.includes("downloads[0].url")));
  assert.ok(validateProject({ slug: "p", name: "P", category: "Games", status: { stage: "beta" }, summary: "s", featured: true, order: 1, sections: [{ type: "unknown" }] }).length === 1);
  assert.ok(validateSite({ name: "x", description: "d", hero: { headline: "h" }, contact: { email: "nope" } }).length === 1);
  assert.ok(validateFeed({ entries: [{ title: "" }] }).length === 1);
});

test("the real content of the repository is valid", async () => {
  const ctx = await loadContent();
  assert.deepEqual(ctx.errors, []);
  assert.ok(ctx.projects.some((p) => p.slug === "mlbclient"));
  assert.ok(ctx.projects.some((p) => p.slug === "city-life"));
  assert.ok(!ctx.projects.some((p) => p.slug === "operation-iron-veil"));
});

test("no invented download links or release claims for unreleased versions", async () => {
  const ctx = await loadContent();
  const mlb = ctx.projects.find((p) => p.slug === "mlbclient");
  const release = mlb.sections.find((s) => s.type === "release");
  for (const d of release.downloads) assert.ok(d.url === "" || /^https:\/\//.test(d.url));
  const upcoming = mlb.sections.find((s) => s.type === "upcoming");
  assert.match(upcoming.intro, /Nothing below is released/);
  assert.ok(!JSON.stringify(mlb).includes("HanamiClient"), "the possible rebranding must not be applied yet");
  const cl = ctx.projects.find((p) => p.slug === "city-life");
  assert.equal(cl.sections.find((s) => s.type === "gallery").items.length, 0, "no invented screenshots");
  assert.ok(!JSON.stringify(ctx).includes("GTA"), "no third-party game names");
});
