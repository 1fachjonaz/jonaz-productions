import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../api/contact.js";

const form = (o) => new Request("https://site.test/api/contact", { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o).toString() });
const good = { name: "Test User", email: "a@b.de", topic: "Bug report", message: "Hello @everyone, this is a test." };

test("contact: refuses when no webhook is configured", async () => {
  delete process.env.CONTACT_WEBHOOK_URL;
  assert.equal((await POST(form(good))).status, 503);
});

test("contact: validates, filters bots and forwards to Discord without pings", async () => {
  process.env.CONTACT_WEBHOOK_URL = "https://discord.com/api/webhooks/1/abc";
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); };
  try {
    assert.equal((await POST(form({ ...good, email: "nope" }))).status, 422);
    assert.equal((await POST(form({ ...good, company: "spam" }))).status, 200);
    assert.equal(sent.length, 0, "honeypot must not send");
    assert.equal((await POST(form(good))).status, 200);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].body.allowed_mentions, { parse: [] });
    assert.ok(!sent[0].body.embeds[0].description.includes("@everyone"));
    const noJs = await POST(new Request("https://site.test/api/contact", { method: "POST", body: new URLSearchParams(good).toString() }));
    assert.equal(noJs.status, 303);
    assert.match(noJs.headers.get("location"), /\/contact\/thanks\/$/);
    globalThis.fetch = async () => new Response("", { status: 500 });
    assert.equal((await POST(form(good))).status, 502);
  } finally { globalThis.fetch = real; }
});
