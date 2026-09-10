# fitness-app (マイトレーニング)

Personal training PWA — vanilla HTML/CSS/JS, no build step, no backend. All data lives in the browser's localStorage (see `js/storage.js`).

## Workflow

- After making changes the user has approved, commit and push to `origin/main` automatically — do not ask for confirmation first.
- Bump `CACHE_NAME` in `service-worker.js` whenever any cached asset changes, so the network-first service worker picks up the update.
- Preferred way to view the app locally: open `index.html` directly via `file://` (double-click, or a desktop shortcut) rather than a local HTTP server — this sidesteps service-worker/caching staleness entirely.
