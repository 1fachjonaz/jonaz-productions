// Contact form on Vercel: validates the message and forwards it to a private Discord channel via webhook.
// Environment: CONTACT_WEBHOOK_URL = Discord webhook URL (Server settings > Integrations > Webhooks).
const LIMITS = { name: 100, email: 200, topic: 60, message: 5000 };
const TOPICS = ["General question", "Business inquiry", "Bug report", "Press"];

const reply = (status, body, request) => {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json") || request.headers.get("x-requested-with");
  if (!wantsJson && status === 200) return Response.redirect(new URL("/contact/thanks/", request.url), 303);
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
};

export async function POST(request) {
  const webhook = process.env.CONTACT_WEBHOOK_URL || "";
  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhook)) return reply(503, { ok: false, error: "The contact form is not configured." }, request);
  let fields;
  try {
    const text = await request.text();
    if (text.length > 12000) return reply(413, { ok: false, error: "Message too long." }, request);
    fields = Object.fromEntries(new URLSearchParams(text));
  } catch { return reply(400, { ok: false, error: "Invalid form data." }, request); }
  if (fields.company) return reply(200, { ok: true }, request); // honeypot: pretend success for bots
  const name = String(fields.name || "").trim().slice(0, LIMITS.name);
  const email = String(fields.email || "").trim().slice(0, LIMITS.email);
  const topic = TOPICS.includes(fields.topic) ? fields.topic : "General question";
  const message = String(fields.message || "").trim().slice(0, LIMITS.message);
  const errors = [];
  if (name.length < 2) errors.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("email");
  if (message.length < 10) errors.push("message");
  if (errors.length) return reply(422, { ok: false, error: "Please check the form.", fields: errors }, request);

  const clean = (s) => s.replace(/@(everyone|here)/gi, "@​$1");
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "MOONCREST GROUP Website",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `Contact: ${topic}`,
        description: clean(message).slice(0, 4000),
        color: 0xe8b83a,
        fields: [{ name: "Name", value: clean(name), inline: true }, { name: "Email", value: clean(email), inline: true }],
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => null);
  if (!res || !res.ok) return reply(502, { ok: false, error: "The message could not be delivered." }, request);
  return reply(200, { ok: true }, request);
}
