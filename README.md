# MOONCREST GROUP – Website

Offizielle Website von MOONCREST GROUP (vorher MOONCREST GROUP) mit den Projektseiten **MLBClient**, **PROJECT: CITY LIFE** und **QuickClient**,
News-System, Kontaktformular und passwortgeschütztem Admin-Bereich.

- **Technik:** statische Seiten, erzeugt von einem kleinen Node-Build (`build/build.mjs`) aus JSON-Inhalten.
  Keine Frameworks, **keine npm-Abhängigkeiten**. Hosting auf Netlify (wie bisher).
- **Inhalte** liegen getrennt vom Design in `content/` und werden im Admin unter `/admin/` bearbeitet.
- **Bestehendes bleibt kompatibel:** `quickclient/news.json` (News-Seite in QuickClient/MLBClient) und `/api/news`
  (`/qcnews` im Spiel) funktionieren unverändert.

---

## Ordnerstruktur

| Pfad | Inhalt |
|---|---|
| `content/site.json` | Studio-Texte, Startseite, About, Kontakt, Social Links, Rechtliches |
| `content/projects/*.json` | ein Projekt pro Datei (Texte, Status, Bilder, Links, Seitenabschnitte) |
| `content/news/*.json` | ein News-Artikel pro Datei (Markdown-Text) |
| `quickclient/news.json` | In-Game-News der Mods (Format unverändert) |
| `src/templates/` | HTML-Vorlagen (Layout, Seiten, Abschnitte, Icons) |
| `assets/css/site.css` | gesamtes Design: Studio-Look + eigene Themes für MLBClient und City Life |
| `assets/js/site.js` | Menü, Filter, Galerie, Countdown, Video, Kontaktformular (Seite funktioniert auch ohne JS) |
| `assets/img/` | Logos und optimierte Bilder (WebP), `assets/uploads/` = Uploads aus dem Admin |
| `assets/img/brand/` | MOONCREST-GROUP-Logo: Wappen mit Halbmond, Schriftzug, App-Icon, Favicons |
| `assets/fonts/` | selbst gehostete Schriften (Archivo, JetBrains Mono – SIL OFL) |
| `admin/` | Admin-Oberfläche |
| `netlify/functions/admin.mjs` | Admin-API (Login, Speichern, Löschen) |
| `netlify/functions/news.mjs` | bestehender `/qcnews`-Endpunkt (unverändert) |
| `api/` | dieselben Endpunkte für Vercel + `api/contact.js` (Kontaktformular → Discord) |
| `vercel.json` | Vercel-Einstellungen |
| `shared/` | Markdown-Renderer und Prüfregeln – gemeinsam für Build, Admin und API |
| `build/` | Build, lokaler Dev-Server, Bildgrößen-Leser |
| `tests/` | automatische Tests |
| `dist/` | fertige Website (wird erzeugt, nicht ins Repo) |

## Lokal entwickeln

Voraussetzung: **Node.js 20 oder neuer** (keine weiteren Installationen nötig).

```bash
npm run dev      # baut die Seite und startet http://localhost:8888
```

- Admin lokal: `http://localhost:8888/admin/`, Passwort `local-admin-password`
  (oder eigenes: `ADMIN_PASSWORD=... npm run dev`).
- Lokal speichert der Admin **direkt in diesen Ordner** (kein GitHub nötig). Danach wird automatisch neu gebaut.
- Änderungen an Dateien in `content/`, `src/`, `assets/` werden ebenfalls automatisch neu gebaut.
- Das Kontaktformular wird lokal nur in der Konsole ausgegeben (Netlify Forms gibt es nur auf Netlify).

## Bauen und testen

```bash
npm run check    # prüft nur die Inhalte (fehlende Bilder, ungültige Links, falsche Felder …)
npm run build    # erzeugt dist/
npm test         # 15 automatische Tests (Markdown-Sicherheit, Prüfregeln, Admin-API, GitHub-Commit, Kontaktformular)
```

Der Build **bricht ab**, wenn Inhalte fehlerhaft sind (z. B. ein Bildpfad, den es nicht gibt) – so kommt keine
kaputte Seite online.

## Online stellen (Vercel)

Das Projekt `jonaz-productions` liegt im Vercel-Team; `vercel.json` enthält Build-Befehl, Ausgabeordner, Weiterleitungen
und Sicherheits-Header. Die Admin- und News-API laufen auf Vercel über `api/admin.js` und `api/news.js` (gleicher Code
wie bei Netlify).

- **Manuell deployen (vom PC):** im Projektordner `npx vercel deploy --prod`
- **Automatisch:** in Vercel › Project › Settings › Git das GitHub-Repo verbinden. Dann baut Vercel bei jedem Push und
  jeder Admin-Speicherung neu (ohne Git-Verbindung landen Admin-Änderungen nur in GitHub, nicht auf Vercel).
- **Umgebungsvariablen** (Vercel › Project › Settings › Environment Variables): `ADMIN_PASSWORD`, `GITHUB_TOKEN`,
  `GITHUB_REPO`, `NEWS_PASSWORD` wie unten, dazu für das Kontaktformular **`CONTACT_WEBHOOK_URL`** = ein
  Discord-Webhook (Discord › Servereinstellungen › Integrationen › Webhooks › Neuer Webhook › URL kopieren). Ohne
  Webhook blendet die Seite das Formular aus und verweist auf Discord. Nach dem Setzen neu deployen.
- Die Website-Adresse für Suchmaschinen/Teilen wird automatisch auf die Vercel-Adresse gesetzt (oder `SITE_URL`).

## Online stellen (Netlify)

Die Seite läuft weiter auf dem bestehenden Netlify-Projekt (`stellar-cucurucho-cc396d.netlify.app`).

1. **Dateien ins GitHub-Repo `1fachjonaz/jonaz-productions` übernehmen.** Den Inhalt des Ordners (ohne `dist/`)
   hochladen bzw. committen. Die alten Dateien `index.html`, `quickclient/index.html`, `admin/index.html` und
   `assets/style.css` werden dabei ersetzt/entfernt.
2. **Netlify übernimmt die Build-Einstellungen aus `netlify.toml`** (Build-Befehl `node build/build.mjs`,
   Ordner `dist`). Falls im Netlify-Dashboard unter *Build settings* noch ein anderer Publish-Ordner steht: leeren
   oder auf `dist` setzen.
3. **Umgebungsvariablen** (Netlify › Site configuration › Environment variables):

   | Variable | Pflicht | Wofür |
   |---|---|---|
   | `ADMIN_PASSWORD` | ja (neu) | Admin-Passwort, **mindestens 10 Zeichen** |
   | `GITHUB_TOKEN` | ja (gibt es schon) | Fine-grained Token, nur dieses Repo, *Contents: Read and write* |
   | `GITHUB_REPO` | ja (gibt es schon) | `1fachjonaz/jonaz-productions` |
   | `GITHUB_BRANCH` | nein | Standard `main` |
   | `NEWS_PASSWORD` | ja (gibt es schon) | Passwort für `/qcnews` im Spiel |
   | `ADMIN_SESSION_SECRET` | nein | zusätzlicher Schlüssel für Admin-Sitzungen |

   Danach **Deploys › Trigger deploy**.
4. **Kontaktformular aktivieren:** Netlify › *Forms* › **Enable form detection**, dann neu deployen. Nachrichten
   erscheinen unter *Forms › contact*; unter *Form notifications* kann man sich eine E-Mail pro Nachricht schicken
   lassen.
5. Optional eigene Domain unter *Domain management*. Dann in `content/site.json` (oder im Admin unter
   *Site & links*) die **Website-Adresse** anpassen – sie wird für Sitemap, Teilen-Vorschauen und Suchmaschinen
   genutzt. Beim Domainwechsel auch `news_url`/`news_post_url` in den Mods anpassen.

## Inhalte bearbeiten (Admin)

`https://<deine-seite>/admin/` › Passwort eingeben. Jede Speicherung wird als **ein Commit** ins GitHub-Repo
geschrieben; Netlify baut daraufhin neu, die Änderung ist nach etwa **einer Minute** live.

- **News:** neu, bearbeiten, löschen; Titel, Datum, Kategorie, Projekt, Kurztext, Titelbild, Text in Markdown mit
  Live-Vorschau, Entwurf/veröffentlicht, oben anpinnen.
- **Projekte:** Texte, Status (z. B. *Beta*, *In development*), Status-Text, Kategorie, Tags, Logo, Icon,
  Cover, Buttons/Links, **Download-Links** und Release-Zeitpunkt, **Screenshots** (hochladen, sortieren,
  entfernen), Featured an/aus, Reihenfolge (↑/↓), neue Projekte anlegen. Unter *Advanced* lassen sich alle
  Seitenabschnitte als JSON bearbeiten.
- **Site & links:** Startseiten-Text, About, Kontakt-E-Mail, Kontaktformular an/aus, Social Links, Impressum,
  Datenschutz.
- **In-game news:** Einträge für die News-Seite in QuickClient/MLBClient hinzufügen oder entfernen.

Bilder werden **im Browser** auf max. 1920 px verkleinert und als WebP gespeichert, bevor sie hochgeladen werden.
Große Dateien (Launcher-Installer, Jars) gehören nicht ins Website-Repo: z. B. als GitHub Release oder auf
CurseForge hochladen und den Link im Admin bei *Downloads* eintragen.

**Sicherheit:** Passwort und GitHub-Token liegen nur in Netlify. Der Browser bekommt nach dem Login ein signiertes
Sitzungs-Token (8 Stunden gültig, nur im Tab gespeichert). Falsche Passwörter werden verzögert beantwortet. Der Admin
darf nur `content/…`, `quickclient/news.json` und Bilder in `assets/uploads/` schreiben; jede Änderung wird mit
denselben Regeln geprüft wie beim Build. Hochgeladene Dateien müssen echte Bilder sein. Passwort ändern = alle
Sitzungen ungültig.

## Neues Projekt hinzufügen

Im Admin *Projects › + New project* – oder eine Datei `content/projects/<slug>.json` anlegen (Vorlage: eine der
vorhandenen Dateien). Die Projektseite, die Projektübersicht, das Menü, der Footer und die Sitemap werden
automatisch erzeugt. Kategorien: `Software`, `Minecraft`, `Games`, `Experimental`. Status: `released`, `beta`,
`in-development`, `pre-production`, `planned`, `legacy`. Design: `default`, `mlbclient`, `citylife`.

**Abschnittstypen** für `sections`: `text`, `story`, `features`, `facts`, `gallery`, `video` (YouTube),
`release` (Downloads + Countdown), `changelog`, `upcoming` (geplante Features), `characters`, `timeline`,
`status` (Checkliste), `news` (News des Projekts), `feed` (In-Game-News), `placeholder` (Platzhalter zum späteren
Füllen), `cta`, `quote`.

## Umgesetzte Funktionen

- Startseite mit Hero, Featured Projects, Latest News, About-Teaser, Community-Aufruf, Footer
- Projektübersicht mit Kategoriefilter; skalierbar über `content/projects/`
- **MLBClient-Seite:** eigenes Design (Plum/Pink), Release-Box mit Live-Countdown bis 15.11.2026 16:00 MEZ
  (Download-Buttons erscheinen automatisch, sobald Zeitpunkt erreicht **und** ein Link eingetragen ist),
  interaktive Feature-Vorschau, In-Game-Features, Trailer (datenschutzfreundlich erst nach Klick), Screenshots mit
  Lightbox, Changelog und Release-Historie, Beta-2-Vorschau klar als „geplant" markiert, Projekt-News, Discord
- **PROJECT: CITY LIFE:** eigene Identität (Sonnenuntergang über einer generierten Skyline am Meer, Koralle/Türkis,
  schmale fette Schrift), Eckdaten (San Cordova, Unreal Engine 5.8, kostenlos geplant), Entwicklungsstatus, leere
  Medien-/Update-Bereiche zum späteren Füllen
- QuickClient-Seite (Vorgänger, CurseForge-Link, In-Game-News)
- News-System mit Übersicht, Kategoriefilter, Artikelseiten, Vor/Zurück, RSS-Feed
- About-, Kontakt- (mit funktionierendem Formular), Rechtliches- und 404-Seite
- SEO: Titel/Beschreibung pro Seite, Canonical, Open Graph + Teilen-Bild, strukturierte Daten (JSON-LD),
  `sitemap.xml`, `robots.txt`
- Responsiv (Mobile, Tablet, Desktop), barrierearm (Tastatur, Skip-Link, ARIA, reduzierte Bewegung)
- Sicherheits-Header inkl. Content-Security-Policy; keine Cookies, kein Tracking, keine externen Schriften
- `/quickclient/` leitet auf `/projects/quickclient/` weiter; `quickclient/news.json` bleibt erreichbar

## Bekannte Einschränkungen

- **Download-Links sind leer.** Es wurde kein Link erfunden. Vor oder nach dem Launch im Admin unter
  *Projects › MLBClient › Release & downloads* eintragen. Bis dahin zeigt die Seite den Countdown bzw. „Links werden
  hier veröffentlicht".
- **Impressum fehlt.** In Deutschland ist für die meisten öffentlichen Websites ein Impressum Pflicht. Im Admin
  unter *Site & links › Legal* eintragen; der Abschnitt erscheint dann automatisch.
- **Keine Kontakt-E-Mail, YouTube-, TikTok- und GitHub-Links eingetragen** – es lagen keine verifizierten Adressen
  vor. Leere Links werden nicht angezeigt; im Admin ergänzen.
- **MLBClient-Screenshots stammen aus dem offiziellen Trailer** (echte Launcher-Oberfläche, teilweise mit
  Trailer-Texten). Echte Screenshots können im Admin ersetzt werden.
- **City Life hat noch keine Bilder.** Schriftzug und Icon sind typografisch gestaltet, die Skyline im Hero ist
  eine Illustration (kein Spielbild). Es wurden keine Screenshots, Features oder Termine erfunden.
- Die **Zukunftsziele** auf der About-Seite sind leer und daher ausgeblendet.
- Der Admin ist für **eine Person** gedacht (ein Passwort, keine Benutzerrollen). Gleichzeitiges Bearbeiten
  derselben Datei: die letzte Speicherung gewinnt.
- Speichern pro Vorgang höchstens ca. 3 MB Bilder (Netlify-Grenze für Functions).
- Das Kontaktformular braucht die aktivierte Netlify-Formularerkennung (siehe oben).
