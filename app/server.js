'use strict';

/**
 * Minimal static file server for the LoanLens web app.
 * No framework on purpose: the app is plain HTML/CSS/JS so the focus stays on the automation.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function resolvePublicPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  // Reject path traversal attempts such as /../server.js
  return filePath.startsWith(PUBLIC_DIR + path.sep) ? filePath : null;
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'] }).end('{"status":"ok"}');
      return;
    }

    const filePath = resolvePublicPath(req.url);
    if (!filePath) {
      res.writeHead(400).end('Bad request');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

function startServer(port = Number(process.env.PORT) || 3000, host = process.env.HOST || '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (require.main === module) {
  startServer().then((server) => {
    const { address, port } = server.address();
    console.log(`LoanLens running at http://${address}:${port}`);
  });
}

module.exports = { createServer, startServer };
