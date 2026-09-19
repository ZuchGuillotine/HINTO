/*
 * Static dev server for apps/web. Mirrors the hosting rewrites in vercel.json:
 *   /                 -> src/index.html
 *   /vote/*           -> src/index.html (client-side routed public vote page)
 *   /privacy, /terms, /support, /data-deletion -> src/legal/<name>.html
 *   any other path    -> the static file if it exists, else 404 (never index.html)
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('./src', import.meta.url));
const host = process.env.WEB_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.WEB_PORT ?? '3001', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const legalPages = {
  '/privacy': 'legal/privacy.html',
  '/terms': 'legal/terms.html',
  '/support': 'legal/support.html',
  '/data-deletion': 'legal/data-deletion.html',
};

function resolveRequest(pathname) {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (cleanPath === '/' || cleanPath === '/index.html') {
    return join(rootDir, 'index.html');
  }

  if (/^\/vote(\/[A-Za-z0-9]*)?$/.test(cleanPath)) {
    return join(rootDir, 'index.html');
  }

  if (legalPages[cleanPath]) {
    return join(rootDir, legalPages[cleanPath]);
  }

  return normalize(join(rootDir, cleanPath));
}

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.statusCode = statusCode;
  response.setHeader('content-type', contentType);
  response.setHeader('cache-control', 'no-store');
  response.end(body);
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
    const filePath = resolveRequest(decodeURIComponent(url.pathname));

    if (!filePath.startsWith(rootDir + sep) && filePath !== rootDir) {
      send(response, 403, 'Forbidden');
      return;
    }

    let data;
    try {
      data = await readFile(filePath);
    } catch {
      send(response, 404, 'Not found');
      return;
    }

    send(response, 200, data, contentTypes[extname(filePath)] ?? 'application/octet-stream');
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : 'Unknown server error');
  }
}).listen(port, host, () => {
  console.log(`HINTO web dev server running at http://${host}:${port}`);
});
