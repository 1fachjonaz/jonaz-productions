# Jonaz Productions website

Static website (no build step) for Netlify:

| Path | What |
|---|---|
| `/` | Home page with projects and the latest news |
| `/quickclient/` | QuickClient page: download, modules, all news |
| `/quickclient/news.json` | The news file - QuickClient's News page loads exactly this file |
| `/admin/` | News editor (writes `news.json` through the GitHub API) |
| `/downloads/` | The mod jar |

## Put it online (once)

1. Create a GitHub repository, e.g. `jonaz-productions`, and upload all files of this folder.
2. On https://app.netlify.com: **Add new site > Import an existing project > GitHub**, pick the repository.
   No build command, publish directory `.` (already set in `netlify.toml`).
3. Netlify > Site configuration > **Change site name** to `jonaz-productions` (if free) -> the site is
   `https://jonaz-productions.netlify.app`. A custom domain can be added later under *Domain management*.
4. In the QuickClient project set in `gradle.properties`:
   `news_url=https://jonaz-productions.netlify.app/quickclient/news.json` (your real address) and build the jar.

## News from inside Minecraft (/qcnews)

The site has a small server function at `/api/news` (`netlify/functions/news.mjs`). It checks a password and writes
`news.json` for you, so you can publish news from the game:

1. Netlify > Site configuration > **Environment variables**, add:
   - `NEWS_PASSWORD` - the password you type in game
   - `GITHUB_TOKEN` - fine-grained token, this repository only, *Contents: Read and write*
   - `GITHUB_REPO` - e.g. `YourName/jonaz-productions`
   - (optional) `GITHUB_BRANCH` = `main`, `NEWS_PATH` = `quickclient/news.json`
   Then **Deploys > Trigger deploy**.
2. In the QuickClient project set `news_post_url=https://jonaz-productions.netlify.app/api/news` (your address) in
   `gradle.properties` and build.
3. In game type `/qcnews`: a window opens with password, version, title and points (separate points with `;`).

The password and the token exist only on Netlify. The mod contains no secret, so decompiling the jar reveals nothing.
Wrong passwords are answered with a delay to slow down guessing.

## Writing news in the browser

Open `/admin/`, enter the repository (`YourName/jonaz-productions`), branch `main` and a GitHub token
(fine-grained token, only this repository, *Contents: Read and write*), press **Connect**, write the entry and press
**Publish**. GitHub stores the file, Netlify publishes it within about a minute, and QuickClient shows it the next time
it refreshes (at most every 10 minutes, or right away after a restart).

The token stays in your browser (only if you tick "Remember on this device") and is sent only to api.github.com.
Without a token the editor cannot change anything, so the admin page being public is not a risk.

## New release

Put the new jar into `downloads/`, update the download link and version text in `quickclient/index.html`, commit.
