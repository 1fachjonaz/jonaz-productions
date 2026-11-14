// Small, safe Markdown renderer for news articles and project texts.
// Supports: headings (##, ###), paragraphs, line breaks, - / 1. lists, > quotes, ``` code blocks, `code`,
// **bold**, *italic*, [links](url), ![images](url "caption"), horizontal rules (---).
// All text is HTML-escaped first; only http(s), mailto, relative and anchor URLs are allowed.

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function safeUrl(url) {
  const u = String(url ?? "").trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^(\/|#|\.\/|\.\.\/)/.test(u)) return u;
  if (/^[a-z0-9][\w\-./]*$/i.test(u) && !u.includes(":")) return u;
  return "#";
}

const isExternal = (u) => /^https?:/i.test(u);

function inline(text) {
  // Protect code spans first.
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = escapeHtml(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, url) =>
    `<img src="${escapeHtml(safeUrl(url.replace(/&amp;/g, "&")))}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const u = safeUrl(url.replace(/&amp;/g, "&"));
    const ext = isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(u)}"${ext}>${label}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[+i])}</code>`);
  return s;
}

export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      // Article titles are h1; content headings start at h2.
      const level = Math.min(Math.max(h[1].length, 2), 4);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote><p>${buf.map(inline).join("<br>")}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push(`<ol>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    const img = buf.length === 1 && buf[0].trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (img) {
      const cap = img[3] ? `<figcaption>${escapeHtml(img[3])}</figcaption>` : "";
      out.push(`<figure><img src="${escapeHtml(safeUrl(img[2]))}" alt="${escapeHtml(img[1])}" loading="lazy" decoding="async">${cap}</figure>`);
    } else {
      out.push(`<p>${buf.map(inline).join("<br>")}</p>`);
    }
  }
  return out.join("\n");
}

export function plainText(src, max = 160) {
  const t = String(src ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : t;
}
