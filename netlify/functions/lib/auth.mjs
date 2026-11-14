// Password login and signed session tokens for the admin API. No database needed:
// a token is "<expiry>.<HMAC>" signed with a key derived from the server-side secrets, so changing ADMIN_PASSWORD
// (or ADMIN_SESSION_SECRET) logs everybody out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SESSION_HOURS = 8;
const digest = (s) => createHash("sha256").update(String(s ?? ""), "utf8").digest();

export function adminConfigured() {
  return (process.env.ADMIN_PASSWORD || "").length >= 10;
}

export function passwordOk(given) {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (expected.length < 10) return false; // refuse weak or missing passwords
  return timingSafeEqual(digest(given), digest(expected));
}

function key() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.GITHUB_TOKEN || "local-development";
  return digest(`jp-admin:${process.env.ADMIN_PASSWORD}:${secret}`);
}

export function issueToken(now = Date.now()) {
  const exp = String(now + SESSION_HOURS * 3600 * 1000);
  const sig = createHmac("sha256", key()).update(exp).digest("base64url");
  return { token: `${exp}.${sig}`, expires: Number(exp) };
}

export function tokenOk(header, now = Date.now()) {
  const m = String(header || "").match(/^Bearer (\d{10,16})\.([\w-]{43})$/);
  if (!m || !adminConfigured()) return false;
  if (Number(m[1]) < now) return false;
  const expected = createHmac("sha256", key()).update(m[1]).digest();
  const given = Buffer.from(m[2], "base64url");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
