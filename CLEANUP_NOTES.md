# Cleanup notes

The active app is `index.html`. It is self-contained and does not load the legacy JavaScript modules.

Removed from this cleanup build:
- `app-new.html`
- duplicate analyzer/section/key/chord normalizer modules
- legacy section/search/song manager modules that are not referenced by `index.html`
- old GitHub Actions patch workflows and trigger files
- stale `sw.js` cache manifest

The cleanup branch keeps the current `index.html` app as the active UI and removes the obsolete parallel architecture.
