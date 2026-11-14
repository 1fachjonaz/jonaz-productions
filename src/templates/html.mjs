// Tagged template that escapes every interpolated value unless it is already safe HTML.
import { escapeHtml } from "../../shared/markdown.mjs";

class Safe {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}

export const raw = (s) => new Safe(String(s ?? ""));

function value(v) {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(value).join("");
  return escapeHtml(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += value(values[i]) + strings[i + 1];
  return new Safe(out);
}

export const when = (cond, fn) => (cond ? fn() : "");
export { escapeHtml };
