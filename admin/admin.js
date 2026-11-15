// MOONCREST GROUP admin. Talks only to /api/admin; no secret is stored in this file.
// The session token lives in sessionStorage (cleared when the tab closes) and expires after 8 hours.
import { renderMarkdown } from "./markdown.mjs";
import { validateNews, validateProject, validateSite, CATEGORIES, STAGES, STAGE_LABELS, THEMES, NEWS_CATEGORIES, SLUG_RE } from "./schema.mjs";

const app = document.getElementById("app");
const toastEl = document.getElementById("toast");
const state = { token: sessionStorage.getItem("jp-admin") || "", data: null, tab: "news", storage: null, uploads: new Map(), recent: new Map() };

/* ---------------------------------------------------------------- helpers */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
const today = () => new Date().toISOString().slice(0, 10);
let toastTimer;
function toast(text, kind = "ok") {
  toastEl.textContent = text;
  toastEl.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.className = "toast"), kind === "err" ? 7000 : 4000);
}
function field(label, input, hint) {
  return h("label", { class: "f" }, h("span", {}, label, hint ? h("small", {}, `  ${hint}`) : ""), input);
}
function text(obj, key, attrs = {}) {
  return h("input", { type: "text", value: obj[key] ?? "", oninput: (e) => (obj[key] = e.target.value), ...attrs });
}
function area(obj, key, attrs = {}) {
  return h("textarea", { oninput: (e) => (obj[key] = e.target.value), ...attrs }, obj[key] ?? "");
}
function select(obj, key, options, attrs = {}) {
  const el = h("select", { onchange: (e) => (obj[key] = e.target.value), ...attrs },
    options.map((o) => (Array.isArray(o) ? h("option", { value: o[0] }, o[1]) : h("option", { value: o }, o))));
  el.value = obj[key] ?? "";
  return el;
}
function checkbox(obj, key, label) {
  return h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!obj[key], onchange: (e) => (obj[key] = e.target.checked) }), label);
}
function errorsBox(errors) {
  return errors.length ? h("ul", { class: "errors" }, errors.map((e) => h("li", {}, e))) : "";
}

/* ---------------------------------------------------------------- API */
async function api(action, payload = {}) {
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  let body = {};
  try { body = await res.json(); } catch { /* not json */ }
  if (res.status === 401 && action !== "login") { logout("Your session has ended. Please log in again."); throw new Error("Not logged in"); }
  if (!res.ok || !body.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.details = body.details || [];
    throw err;
  }
  return body;
}

async function load() {
  const d = await api("load");
  state.data = d;
  state.storage = d.storage;
}

/** Saves one item. Uploaded images that the content uses are sent in the same request (one commit). */
async function save(kind, data, previousSlug, button) {
  const json = JSON.stringify(data);
  const uploads = [...state.uploads.entries()].filter(([p]) => json.includes("/" + p)).map(([path, u]) => ({ path, base64: u.base64 }));
  const size = uploads.reduce((s, u) => s + u.base64.length, 0);
  if (size > 4.5 * 1024 * 1024) throw new Error("The images are too large together (max ~3 MB per save). Save fewer images at once.");
  if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = "Saving…"; }
  try {
    const r = await api("save", { kind, data, previousSlug, uploads });
    uploads.forEach((u) => { state.recent.set(u.path, state.uploads.get(u.path)); state.uploads.delete(u.path); }); // keep a preview until the site is rebuilt
    toast(r.storage === "github" ? "Saved. The site rebuilds and is live in about a minute." : "Saved.");
    await load();
    return true;
  } finally {
    if (button) { button.disabled = false; button.textContent = button.dataset.label; }
  }
}

function logout(message) {
  state.token = "";
  sessionStorage.removeItem("jp-admin");
  renderLogin(message);
}

/* ---------------------------------------------------------------- images */
/** Resizes an image in the browser (max 1920 px wide) and converts it to WebP before it is uploaded. */
function processImage(file, maxW = 1920) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return reject(new Error("Please choose a PNG, JPEG, WebP or GIF image."));
    if (file.size > 25 * 1024 * 1024) return reject(new Error("The image is larger than 25 MB."));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The image could not be read.")); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const g = c.getContext("2d");
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) return reject(new Error("The image could not be converted."));
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result, base64: String(reader.result).split(",")[1], ext: blob.type === "image/webp" ? "webp" : "png", bytes: blob.size });
        reader.readAsDataURL(blob);
      }, "image/webp", 0.86);
    };
    img.src = url;
  });
}

async function pickImage(baseName) {
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
  return new Promise((resolve) => {
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      try {
        const out = await processImage(file);
        const name = `${slugify(baseName || file.name.replace(/\.\w+$/, "")) || "image"}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `assets/uploads/${new Date().getFullYear()}/${name}.${out.ext}`;
        state.uploads.set(path, out);
        toast(`Image ready (${Math.round(out.bytes / 1024)} KB). It is uploaded when you save.`);
        resolve("/" + path);
      } catch (err) { toast(err.message, "err"); resolve(null); }
    };
    input.click();
  });
}

const srcFor = (p) => {
  if (!p) return "";
  const key = p.replace(/^\//, "");
  const up = state.uploads.get(key) || state.recent.get(key);
  return up ? up.dataUrl : p;
};

function imageField(label, obj, key, baseName) {
  const prev = h("div", { class: "prev" });
  const input = h("input", { type: "text", value: obj[key] || "", placeholder: "/assets/... or upload", oninput: (e) => { obj[key] = e.target.value; paint(); } });
  function paint() { prev.replaceChildren(obj[key] ? h("img", { src: srcFor(obj[key]), alt: "" }) : "No image"); }
  paint();
  return field(label, h("div", { class: "img-field" }, prev, h("div", { class: "rows" }, input, h("div", { class: "row-actions" },
    h("button", { type: "button", class: "btn small", onclick: async () => { const p = await pickImage(baseName?.()); if (p) { obj[key] = p; input.value = p; paint(); } } }, "Upload image"),
    h("button", { type: "button", class: "btn small", onclick: () => { obj[key] = ""; input.value = ""; paint(); } }, "Remove")))));
}

/** Editable list of objects (links, downloads, social…). */
function rowsEditor(list, columns, { add = "Add row", empty = {} } = {}) {
  const box = h("div", { class: "rows" });
  const paint = () => {
    box.replaceChildren(
      ...list.map((item, i) => h("div", { class: "rowline", style: `--cols: ${columns.map((c) => c.w || "1fr").join(" ")} auto` },
        ...columns.map((c) => field(c.label, c.options ? select(item, c.key, c.options) : text(item, c.key, { placeholder: c.placeholder || "" }))),
        h("div", { class: "row-actions" },
          h("button", { type: "button", class: "btn small", title: "Move up", "aria-label": "Move up", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); } }, "↑"),
          h("button", { type: "button", class: "btn small danger", "aria-label": "Remove", onclick: () => { list.splice(i, 1); paint(); } }, "✕")))),
      h("div", {}, h("button", { type: "button", class: "btn small", onclick: () => { list.push(clone(empty)); paint(); } }, add)));
  };
  paint();
  return box;
}

/* ---------------------------------------------------------------- login */
async function renderLogin(message = "") {
  let status = null;
  try { status = await api("status"); } catch { /* offline */ }
  const err = h("p", { role: "alert", style: "color: var(--bad)" }, message);
  const pw = h("input", { type: "password", autocomplete: "current-password", required: true, id: "pw" });
  const btn = h("button", { class: "btn primary", type: "submit" }, "Log in");
  app.replaceChildren(h("div", { class: "login" }, h("form", {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true; btn.textContent = "Checking…"; err.textContent = "";
      try {
        const r = await api("login", { password: pw.value });
        state.token = r.token;
        sessionStorage.setItem("jp-admin", r.token);
        await start();
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = "Log in"; pw.select(); }
    },
  },
  h("h1", {}, h("img", { src: "/assets/img/brand/mark.svg", alt: "" }), "Admin"),
  h("p", {}, "MOONCREST GROUP content manager"),
  status && !status.configured ? h("p", { class: "note warn" }, "The admin is not set up on the server yet. Set ADMIN_PASSWORD, GITHUB_TOKEN and GITHUB_REPO in Netlify (see README).") : "",
  field("Password", pw), err, btn)));
  pw.focus();
}

/* ---------------------------------------------------------------- shell */
const TABS = [["news", "News"], ["projects", "Projects"], ["site", "Site & links"], ["feed", "In-game news"]];
function shell(content) {
  app.replaceChildren(h("div", { class: "shell" },
    h("nav", { class: "side", "aria-label": "Admin" },
      h("div", { class: "brand" }, h("img", { src: "/assets/img/brand/mark.svg", alt: "" }), "ADMIN"),
      TABS.map(([id, label]) => h("button", { class: "tab", "aria-current": String(state.tab === id), onclick: () => { state.tab = id; route(); } }, label)),
      h("div", { class: "foot" },
        h("span", {}, state.storage === "github" ? "Saving to GitHub → Netlify rebuild" : `Storage: ${state.storage || "?"}`),
        h("a", { href: "/", target: "_blank" }, "Open website ↗"),
        h("button", { class: "btn small", onclick: () => logout() }, "Log out"))),
    h("main", { class: "main" }, content)));
  window.scrollTo(0, 0);
}

function route(arg) {
  const views = { news: newsList, projects: projectList, site: siteEditor, feed: feedEditor };
  shell(views[state.tab](arg));
}

/* ---------------------------------------------------------------- news */
function newsList() {
  const list = state.data.news;
  return h("div", {},
    h("div", { class: "head" }, h("h1", {}, "News"), h("button", { class: "btn primary", onclick: () => shell(newsEditor(null)) }, "+ New article")),
    list.length ? h("div", { class: "list" }, list.map((n) => h("div", { class: "item" },
      h("img", { src: srcFor(n.cover) || "/assets/img/brand/mark.svg", alt: "" }),
      h("div", {}, h("h3", {}, n.title), h("div", { class: "sub" }, n.date, " · ", n.category,
        n.published ? h("span", { class: "pill on" }, "Published") : h("span", { class: "pill draft" }, "Draft"),
        n.pinned ? h("span", { class: "pill" }, "Pinned") : "")),
      h("div", { class: "row-actions" },
        n.published ? h("a", { class: "btn small", href: `/news/${n.slug}/`, target: "_blank" }, "View") : "",
        h("button", { class: "btn small", onclick: () => shell(newsEditor(n)) }, "Edit"),
        h("button", { class: "btn small danger", onclick: async (e) => {
          if (!confirm(`Delete "${n.title}"? This cannot be undone here (it stays in the Git history).`)) return;
          e.target.disabled = true;
          try { await api("delete", { kind: "news", slug: n.slug }); toast("Article deleted."); await load(); route(); } catch (ex) { toast(ex.message, "err"); e.target.disabled = false; }
        } }, "Delete"))))) : h("p", { class: "muted" }, "No articles yet."));
}

function newsEditor(original) {
  const n = original ? clone(original) : { slug: "", title: "", date: today(), category: "Development update", project: "", cover: "", coverAlt: "", excerpt: "", published: true, pinned: false, body: "" };
  const slugTouched = { v: !!original };
  const errBox = h("div");
  const preview = h("div", { class: "preview" });
  const paintPreview = () => { preview.innerHTML = renderMarkdown(n.body || "*Nothing written yet.*"); };
  const slugInput = text(n, "slug", { oninput: (e) => { n.slug = e.target.value; slugTouched.v = true; } });
  const title = text(n, "title", { required: true, oninput: (e) => { n.title = e.target.value; if (!slugTouched.v) { n.slug = slugify(n.title); slugInput.value = n.slug; } } });
  const body = area(n, "body", { class: "body", oninput: (e) => { n.body = e.target.value; paintPreview(); } });
  paintPreview();
  const saveBtn = h("button", { class: "btn primary", type: "submit" }, "Save article");
  return h("form", { class: "form", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const errors = validateNews(n);
      errBox.replaceChildren(errorsBox(errors));
      if (errors.length) return errBox.scrollIntoView({ behavior: "smooth" });
      try { await save("news", n, original?.slug, saveBtn); state.tab = "news"; route(); }
      catch (ex) { errBox.replaceChildren(errorsBox([ex.message, ...(ex.details || [])])); toast(ex.message, "err"); }
    } },
    h("div", { class: "head" }, h("h1", {}, original ? "Edit article" : "New article"), h("button", { type: "button", class: "btn", onclick: () => route() }, "← Back")),
    errBox,
    h("fieldset", {}, h("legend", {}, "Article"),
      field("Title", title),
      h("div", { class: "grid3" },
        field("Date", h("input", { type: "date", value: n.date, oninput: (e) => (n.date = e.target.value) })),
        field("Category", select(n, "category", NEWS_CATEGORIES)),
        field("Project", select(n, "project", [["", "— none —"], ...state.data.projects.map((p) => [p.slug, p.name])]))),
      field("Short summary", area(n, "excerpt", { maxlength: 400 }), "shown in lists and search results"),
      field("URL slug", slugInput, "/news/<slug>/ — lowercase letters, numbers and dashes"),
      h("div", { class: "grid2" }, checkbox(n, "published", "Published (visible on the website)"), checkbox(n, "pinned", "Pinned to the top"))),
    h("fieldset", {}, h("legend", {}, "Cover image"), imageField("Cover", n, "cover", () => n.slug || n.title), field("Image description (alt text)", text(n, "coverAlt"))),
    h("fieldset", {}, h("legend", {}, "Content"),
      h("p", { class: "muted", style: "margin:0;font-size:13px" }, "Markdown: ## heading, **bold**, *italic*, - list, [link](https://…), ![image](/assets/…)."),
      h("div", { class: "row-actions" }, h("button", { type: "button", class: "btn small", onclick: async () => {
        const p = await pickImage(n.slug || "article-image");
        if (p) { const ins = `\n\n![Image description](${p})\n`; body.setRangeText(ins, body.selectionStart, body.selectionEnd, "end"); n.body = body.value; paintPreview(); }
      } }, "Insert image")),
      h("div", { class: "split" }, body, preview)),
    h("div", { class: "bar" }, h("button", { type: "button", class: "btn", onclick: () => route() }, "Cancel"), saveBtn));
}

/* ---------------------------------------------------------------- projects */
function projectList() {
  const list = state.data.projects;
  const saveOrder = async (slugs) => {
    try { await api("save", { kind: "order", data: { slugs } }); toast("Order saved."); await load(); route(); } catch (ex) { toast(ex.message, "err"); }
  };
  const quick = async (p, change, btn) => {
    const next = { ...clone(p), ...change };
    try { await save("project", next, p.slug, btn); route(); } catch (ex) { toast(ex.message, "err"); }
  };
  return h("div", {},
    h("div", { class: "head" }, h("h1", {}, "Projects"), h("button", { class: "btn primary", onclick: () => shell(projectEditor(null)) }, "+ New project")),
    h("p", { class: "note" }, "Featured projects appear on the home page. The order here is the order everywhere on the site."),
    h("div", { class: "list" }, list.map((p, i) => h("div", { class: "item" },
      h("img", { src: srcFor(p.cover || p.icon || p.logo) || "/assets/img/brand/mark.svg", alt: "" }),
      h("div", {}, h("h3", {}, p.name), h("div", { class: "sub" }, p.category, " · ", p.status?.label || STAGE_LABELS[p.status?.stage],
        p.featured ? h("span", { class: "pill on" }, "Featured") : "")),
      h("div", { class: "row-actions" },
        h("button", { class: "btn small", disabled: i === 0, "aria-label": "Move up", onclick: () => { const s = list.map((x) => x.slug); [s[i - 1], s[i]] = [s[i], s[i - 1]]; saveOrder(s); } }, "↑"),
        h("button", { class: "btn small", disabled: i === list.length - 1, "aria-label": "Move down", onclick: () => { const s = list.map((x) => x.slug); [s[i + 1], s[i]] = [s[i], s[i + 1]]; saveOrder(s); } }, "↓"),
        h("button", { class: "btn small", onclick: (e) => quick(p, { featured: !p.featured }, e.target) }, p.featured ? "Unfeature" : "Feature"),
        h("a", { class: "btn small", href: `/projects/${p.slug}/`, target: "_blank" }, "View"),
        h("button", { class: "btn small", onclick: () => shell(projectEditor(p)) }, "Edit"),
        h("button", { class: "btn small danger", onclick: async (e) => {
          if (!confirm(`Delete the project "${p.name}"?`)) return;
          try { await api("delete", { kind: "project", slug: p.slug }); toast("Project deleted."); await load(); route(); } catch (ex) { toast(ex.message, "err"); }
        } }, "Delete"))))));
}

function projectEditor(original, working) {
  const p = working || (original ? clone(original) : {
    slug: "", name: "", category: "Software", theme: "default", featured: false, order: state.data.projects.length + 1,
    status: { stage: "planned", label: "" }, tagline: "", summary: "", description: "", tags: [], logo: "", cover: "", coverAlt: "",
    links: [], seo: { title: "", description: "" }, hero: { eyebrow: "" },
    sections: [{ type: "placeholder", id: "about", title: "More information", text: "Details will be announced soon." }],
  });
  p.links ||= []; p.seo ||= {}; p.hero ||= {}; p.sections ||= []; p.status ||= { stage: "planned" };
  const errBox = h("div");
  const slugTouched = { v: !!original };
  const slugInput = text(p, "slug", { oninput: (e) => { p.slug = e.target.value; slugTouched.v = true; } });
  const base = () => p.slug || p.name;

  // Release (download) section, if the project has one
  const release = p.sections.find((s) => s.type === "release");
  const releaseSet = release ? h("fieldset", {}, h("legend", {}, "Release & downloads"),
    h("div", { class: "grid3" }, field("Title", text(release, "title")), field("Launcher/app version", text(release, "version")), field("Client version", text(release, "clientVersion"))),
    h("div", { class: "grid2" },
      field("Release time", h("input", { type: "text", value: release.availableFrom || "", placeholder: "2026-11-15T16:00:00+01:00", oninput: (e) => (release.availableFrom = e.target.value) }), "ISO time with offset; empty = available now"),
      field("Status text", text(release, "status"))),
    field("Text before release", text(release, "availableText")),
    field("Requirements", text(release, "requirements")),
    field("Downloads", rowsEditor(release.downloads ||= [], [
      { key: "label", label: "Label" }, { key: "platform", label: "Platform" }, { key: "file", label: "File type", w: ".6fr" }, { key: "url", label: "Download URL (https://…)", w: "2fr" },
    ], { add: "Add download", empty: { label: "", platform: "", file: "", url: "" } }), "a download button only appears when a URL is set"),
    field("Note", text(release, "notes"))) : "";

  // Galleries (screenshots)
  const galleries = p.sections.filter((s) => s.type === "gallery" || (s.type === "upcoming" && s.gallery));
  const galleryEditor = (list, title) => {
    const box = h("div", { class: "thumbs" });
    const paint = () => box.replaceChildren(
      ...list.map((g, i) => h("div", { class: "thumb" }, h("img", { src: srcFor(g.src), alt: "" }),
        text(g, "alt", { placeholder: "Description (alt text)" }), text(g, "caption", { placeholder: "Caption" }),
        h("div", { class: "row-actions" },
          h("button", { type: "button", class: "btn small", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; paint(); } }, "←"),
          h("button", { type: "button", class: "btn small", disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; paint(); } }, "→"),
          h("button", { type: "button", class: "btn small danger", onclick: () => { list.splice(i, 1); paint(); } }, "Remove")))),
      h("div", { class: "thumb", style: "place-content:center" }, h("button", { type: "button", class: "btn", onclick: async () => {
        const src = await pickImage(`${base()}-screenshot`);
        if (src) { list.push({ src, alt: `${p.name} screenshot`, caption: "" }); paint(); }
      } }, "+ Add image")));
    paint();
    return h("fieldset", {}, h("legend", {}, title), box);
  };

  const sectionsArea = h("textarea", { class: "code", spellcheck: "false" });
  const adv = h("details", { class: "adv", ontoggle: () => { if (adv.open) sectionsArea.value = JSON.stringify(p.sections, null, 2); } },
    h("summary", {}, "Advanced: all page sections as JSON (features, story, timeline, changelog, …)"),
    h("p", { class: "muted", style: "font-size:13px" }, "Section types: text, story, features, facts, gallery, video, release, changelog, upcoming, characters, timeline, status, news, feed, placeholder, cta, quote. Changes here replace the sections when you save."),
    sectionsArea);

  const saveBtn = h("button", { class: "btn primary", type: "submit" }, "Save project");
  return h("form", { class: "form", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (adv.open) {
        try { p.sections = JSON.parse(sectionsArea.value); } catch (ex) { errBox.replaceChildren(errorsBox([`Sections JSON: ${ex.message}`])); return; }
      }
      p.tags = (typeof p.tags === "string" ? p.tags.split(",") : p.tags).map((t) => t.trim()).filter(Boolean);
      p.order = Number(p.order) || 1;
      const errors = validateProject(p);
      errBox.replaceChildren(errorsBox(errors));
      if (errors.length) return errBox.scrollIntoView({ behavior: "smooth" });
      try { await save("project", p, original?.slug, saveBtn); state.tab = "projects"; route(); }
      catch (ex) { errBox.replaceChildren(errorsBox([ex.message, ...(ex.details || [])])); toast(ex.message, "err"); }
    } },
    h("div", { class: "head" }, h("h1", {}, original ? `Edit ${original.name}` : "New project"), h("button", { type: "button", class: "btn", onclick: () => route() }, "← Back")),
    errBox,
    h("fieldset", {}, h("legend", {}, "Basics"),
      h("div", { class: "grid2" },
        field("Name", text(p, "name", { oninput: (e) => { p.name = e.target.value; if (!slugTouched.v) { p.slug = slugify(p.name); slugInput.value = p.slug; } } })),
        field("URL slug", slugInput, "/projects/<slug>/")),
      h("div", { class: "grid3" },
        field("Category", select(p, "category", CATEGORIES)),
        field("Page design", select(p, "theme", THEMES.map((t) => [t, { default: "Studio (default)", mlbclient: "MLBClient", citylife: "City Life" }[t]]))),
        field("Order", h("input", { type: "number", value: p.order, min: 1, oninput: (e) => (p.order = Number(e.target.value)) }))),
      checkbox(p, "featured", "Featured on the home page")),
    h("fieldset", {}, h("legend", {}, "Status"),
      h("div", { class: "grid2" },
        field("Development status", select(p.status, "stage", STAGES.map((s) => [s, STAGE_LABELS[s]]))),
        field("Status label", text(p.status, "label", { placeholder: "e.g. Beta 1 · Launch 15 Nov 2026" }), "optional"))),
    h("fieldset", {}, h("legend", {}, "Texts"),
      field("Tagline", text(p, "tagline")),
      field("Short description", area(p, "summary"), "cards and search results"),
      field("Full description", area(p, "description", { rows: 5 })),
      field("Tags", h("input", { type: "text", value: (p.tags || []).join(", "), oninput: (e) => (p.tags = e.target.value) }), "comma separated"),
      h("div", { class: "grid2" }, field("Hero eyebrow", text(p.hero, "eyebrow")), field("Hero headline", text(p.hero, "headline"))),
      field("Trailer (YouTube link)", text(p.hero, "trailer"))),
    h("fieldset", {}, h("legend", {}, "Images"),
      imageField("Logo", p, "logo", () => `${base()}-logo`),
      imageField("Small icon (square, optional)", p, "icon", () => `${base()}-icon`),
      imageField("Cover / banner", p, "cover", () => `${base()}-cover`),
      field("Cover description (alt text)", text(p, "coverAlt"))),
    h("fieldset", {}, h("legend", {}, "Links (buttons on the project page)"),
      rowsEditor(p.links, [{ key: "label", label: "Label" }, { key: "url", label: "URL", w: "2fr" }, { key: "kind", label: "Icon", options: [["", "Arrow"], ["discord", "Discord"], ["website", "Website"], ["download", "Download"], ["youtube", "YouTube"], ["github", "GitHub"]] }],
        { add: "Add link", empty: { label: "", url: "", kind: "" } })),
    releaseSet,
    ...galleries.map((g) => galleryEditor(g.type === "upcoming" ? g.gallery : (g.items ||= []), `${g.title || "Gallery"} (images)`)),
    galleries.some((g) => g.type === "gallery") ? "" : h("fieldset", {}, h("legend", {}, "Screenshots"), h("button", { type: "button", class: "btn", onclick: () => {
      p.sections.push({ type: "gallery", id: "screenshots", title: "Screenshots", items: [] });
      shell(projectEditor(original, p));
    } }, "Add a screenshot gallery to this page")),
    h("fieldset", {}, h("legend", {}, "Search engines"),
      field("Page title", text(p.seo, "title"), "optional"), field("Description", area(p.seo, "description"), "optional")),
    adv,
    h("div", { class: "bar" }, h("button", { type: "button", class: "btn", onclick: () => route() }, "Cancel"), saveBtn));
}

/* ---------------------------------------------------------------- site */
function siteEditor() {
  const s = clone(state.data.site);
  s.hero ||= {}; s.about ||= {}; s.contact ||= {}; s.legal ||= {}; s.social ||= []; s.about.philosophy ||= [];
  const errBox = h("div");
  const saveBtn = h("button", { class: "btn primary", type: "submit" }, "Save settings");
  return h("form", { class: "form", novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      const errors = validateSite(s);
      errBox.replaceChildren(errorsBox(errors));
      if (errors.length) return;
      try { await save("site", s, null, saveBtn); route(); } catch (ex) { errBox.replaceChildren(errorsBox([ex.message, ...(ex.details || [])])); toast(ex.message, "err"); }
    } },
    h("div", { class: "head" }, h("h1", {}, "Site & links")),
    errBox,
    h("fieldset", {}, h("legend", {}, "Website"),
      h("div", { class: "grid2" }, field("Studio name", text(s, "name")), field("Website address", text(s, "url"), "used for links in search engines and sharing")),
      field("Description", area(s, "description"))),
    h("fieldset", {}, h("legend", {}, "Home page"),
      field("Eyebrow", text(s.hero, "eyebrow")), field("Headline", text(s.hero, "headline")), field("Text", area(s.hero, "text"))),
    h("fieldset", {}, h("legend", {}, "About"),
      field("Introduction", area(s.about, "intro")), field("Vision", area(s.about, "vision")),
      field("Philosophy", rowsEditor(s.about.philosophy, [{ key: "title", label: "Title" }, { key: "text", label: "Text", w: "2fr" }], { add: "Add point", empty: { title: "", text: "" } })),
      field("Future goals", area(s.about, "goals", { rows: 4 }), "Markdown; the section is hidden while empty")),
    h("fieldset", {}, h("legend", {}, "Contact"),
      h("div", { class: "grid2" }, field("Business email", h("input", { type: "email", value: s.contact.email || "", oninput: (e) => (s.contact.email = e.target.value) }), "shown publicly; empty = hidden"),
        field("Discord label", text(s.contact, "discordLabel"))),
      field("Contact form text", area(s.contact, "formIntro")),
      checkbox(s.contact, "formEnabled", "Contact form enabled")),
    h("fieldset", {}, h("legend", {}, "Social links"),
      h("p", { class: "muted", style: "margin:0;font-size:13px" }, "Links without a URL are hidden on the website."),
      rowsEditor(s.social, [{ key: "label", label: "Label" }, { key: "url", label: "URL", w: "2fr" }, { key: "icon", label: "Icon", options: ["discord", "youtube", "tiktok", "github", "curseforge", "globe"] }],
        { add: "Add social link", empty: { label: "", url: "", icon: "globe" } })),
    h("fieldset", {}, h("legend", {}, "Legal"),
      field("Imprint (Impressum)", area(s.legal, "imprint", { rows: 5 }), "Markdown; required in Germany for most public websites"),
      field("Privacy", area(s.legal, "privacy", { rows: 6 })),
      field("Disclaimer", area(s.legal, "disclaimer"))),
    h("div", { class: "bar" }, saveBtn));
}

/* ---------------------------------------------------------------- in-game feed */
function feedEditor() {
  const feed = clone(state.data.feed || { entries: [] });
  const draft = { version: "", title: "", lines: "" };
  const saveBtn = h("button", { class: "btn primary", type: "button" }, "Save in-game news");
  const listBox = h("div", { class: "list" });
  const paint = () => listBox.replaceChildren(...(feed.entries.length ? feed.entries.map((e, i) => h("div", { class: "item" }, h("span", {}),
    h("div", {}, h("h3", {}, e.title), h("div", { class: "sub" }, e.version ? `v${e.version}` : "", e.date || "", ` · ${(e.lines || []).length} points`)),
    h("div", { class: "row-actions" }, h("button", { class: "btn small danger", type: "button", onclick: () => { feed.entries.splice(i, 1); paint(); } }, "Remove")))) : [h("p", { class: "muted" }, "No entries.")]));
  paint();
  saveBtn.onclick = async () => {
    try { await save("feed", feed, null, saveBtn); route(); } catch (ex) { toast(ex.message, "err"); }
  };
  return h("div", { class: "form" },
    h("div", { class: "head" }, h("h1", {}, "In-game news")),
    h("p", { class: "note" }, "These entries appear on the News page inside QuickClient and MLBClient (file quickclient/news.json) and on the QuickClient project page. /qcnews in game writes to the same list."),
    listBox,
    h("fieldset", {}, h("legend", {}, "New entry"),
      h("div", { class: "grid2" }, field("Version", text(draft, "version", { placeholder: "e.g. 0.1.0-beta" })), field("Title", text(draft, "title"))),
      field("Points", area(draft, "lines"), "one per line"),
      h("div", {}, h("button", { type: "button", class: "btn", onclick: () => {
        if (!draft.title.trim()) return toast("The entry needs a title.", "err");
        feed.entries.unshift({ id: `admin-${Date.now()}`, version: draft.version.trim().replace(/^v/i, ""), date: today(), title: draft.title.trim().slice(0, 80), lines: draft.lines.split("\n").map((l) => l.trim().replace(/^[-*•]\s*/, "")).filter(Boolean).slice(0, 20) });
        draft.title = draft.version = draft.lines = "";
        paint();
        toast("Entry added to the list. Press Save to publish.");
      } }, "Add to list"))),
    h("div", { class: "bar" }, saveBtn));
}

/* ---------------------------------------------------------------- start */
async function start() {
  app.replaceChildren(h("p", { class: "boot" }, "Loading content…"));
  try { await load(); route(); } catch (ex) { if (state.token) { app.replaceChildren(h("div", { class: "login" }, h("div", {}, h("p", { class: "errors" }, ex.message), h("button", { class: "btn", onclick: start }, "Try again"), " ", h("button", { class: "btn", onclick: () => logout() }, "Log out")))); } }
}

window.addEventListener("beforeunload", (e) => { if (state.uploads.size) { e.preventDefault(); e.returnValue = ""; } });
if (state.token) start(); else renderLogin();
