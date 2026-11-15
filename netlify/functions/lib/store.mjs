// Content storage for the admin API.
//  - GitHub (production): reads and writes the repository through the GitHub API. Every save is ONE commit, which
//    makes Netlify rebuild the site.
//  - Local folder (development): ADMIN_LOCAL_DIR=/path/to/repo writes files directly (used by `npm run dev`).
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const CONTENT_RE = /^(content\/(site\.json|projects\/[a-z0-9-]+\.json|news\/[a-z0-9-]+\.json)|quickclient\/news\.json)$/;
const UPLOAD_RE = /^assets\/uploads\/\d{4}\/[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpe?g|gif)$/;

/** Only content files and uploaded images may ever be written through the admin. */
export function assertWritable(p) {
  if (!CONTENT_RE.test(p) && !UPLOAD_RE.test(p)) throw Object.assign(new Error(`Path not allowed: ${p}`), { status: 400 });
}

export function getStore() {
  if (process.env.ADMIN_LOCAL_DIR) return localStore(process.env.ADMIN_LOCAL_DIR);
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return null;
  return githubStore(repo, token, process.env.GITHUB_BRANCH || "main");
}

function localStore(root) {
  const abs = (p) => path.join(root, p);
  return {
    kind: "local",
    async readContent() {
      const out = {};
      const list = async (dir) => (existsSync(abs(dir)) ? (await readdir(abs(dir))).filter((f) => f.endsWith(".json")).map((f) => `${dir}/${f}`) : []);
      for (const p of ["content/site.json", "quickclient/news.json", ...(await list("content/projects")), ...(await list("content/news"))]) {
        if (existsSync(abs(p))) out[p] = await readFile(abs(p), "utf8");
      }
      return out;
    },
    async commit(files) {
      for (const f of files) {
        assertWritable(f.path);
        if (f.delete) { await rm(abs(f.path), { force: true }); continue; }
        await mkdir(path.dirname(abs(f.path)), { recursive: true });
        await writeFile(abs(f.path), f.base64 ? Buffer.from(f.base64, "base64") : f.content);
      }
      return { sha: "local" };
    },
  };
}

function githubStore(repo, token, branch) {
  const api = `https://api.github.com/repos/${repo}`;
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "mooncrest-group-admin", "x-github-api-version": "2022-11-28" };
  const gh = async (url, init = {}) => {
    const res = await fetch(url.startsWith("http") ? url : api + url, { ...init, headers: { ...headers, ...(init.body ? { "content-type": "application/json" } : {}) } });
    if (!res.ok) {
      const err = new Error(`GitHub ${init.method || "GET"} ${url.replace(api, "")} failed (${res.status})`);
      err.status = res.status === 404 ? 502 : res.status;
      err.github = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  };

  return {
    kind: "github",
    async readContent() {
      const ref = await gh(`/git/ref/heads/${encodeURIComponent(branch)}`);
      const commit = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${commit.tree.sha}?recursive=1`);
      const wanted = tree.tree.filter((t) => t.type === "blob" && CONTENT_RE.test(t.path));
      const out = {};
      await Promise.all(wanted.map(async (t) => {
        const blob = await gh(`/git/blobs/${t.sha}`);
        out[t.path] = Buffer.from(blob.content, "base64").toString("utf8");
      }));
      return out;
    },
    /** One commit for all files (Git Data API). Retries once if the branch moved in between. */
    async commit(files, message) {
      files.forEach((f) => assertWritable(f.path));
      for (let attempt = 0; attempt < 2; attempt++) {
        const ref = await gh(`/git/ref/heads/${encodeURIComponent(branch)}`);
        const base = await gh(`/git/commits/${ref.object.sha}`);
        const entries = [];
        for (const f of files) {
          if (f.delete) { entries.push({ path: f.path, mode: "100644", type: "blob", sha: null }); continue; }
          const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify(f.base64 ? { content: f.base64, encoding: "base64" } : { content: f.content, encoding: "utf-8" }) });
          entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }
        const tree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree: entries }) });
        const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }) });
        try {
          await gh(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
          return { sha: commit.sha };
        } catch (err) {
          if (attempt === 0 && (err.github === 422 || err.github === 409)) continue;
          throw err;
        }
      }
      throw Object.assign(new Error("The repository changed at the same time. Please try again."), { status: 409 });
    },
  };
}
