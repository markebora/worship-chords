/*
  Copies the web app from the project root into native/www, which is
  what Capacitor packages into the APK. Run via `npm run sync`.

  With "server.url" set in capacitor.config.json (the default here),
  the app loads the live website, so these bundled files are only a
  fallback. Remove "server" from the config to ship the files inside
  the APK instead (then every index.html change needs a new APK).
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

['index.html', 'pads.html', 'manifest.json'].forEach(file => {
  const from = path.join(root, file);
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(out, file));
});

fs.cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true });

console.log('www ready:', fs.readdirSync(out).join(', '));
