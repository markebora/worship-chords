const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const IMPORTER_PATH = path.join(ROOT, 'api', 'import.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function loadImporter() {
  const source = fs.readFileSync(IMPORTER_PATH, 'utf8')
    .replace(/^\s*export\s+default\s+async\s+function\s+handler/, 'async function handler');
  return new Function(`${source}\nreturn handler;`)();
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleImport(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'POST only' });
  }

  let rawBody = '';
  req.setEncoding('utf8');

  for await (const chunk of req) rawBody += chunk;

  let body;
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const importerReq = {
    method: req.method,
    body,
    headers: req.headers
  };

  let statusCode = 200;
  const importerRes = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      return sendJson(res, statusCode, data);
    },
    end(data) {
      res.writeHead(statusCode);
      return res.end(data);
    }
  };

  try {
    const handler = loadImporter();
    await handler(importerReq, importerRes);
  } catch (error) {
    console.error('Local importer error:', error);
    if (!res.writableEnded) {
      sendJson(res, 500, { error: error?.message || 'Local importer failed.' });
    }
  }
}

const server = http.createServer(async (req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);

  if (requestPath === '/api/import') {
    return handleImport(req, res);
  }

  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Worship Chords local server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server.');
});
