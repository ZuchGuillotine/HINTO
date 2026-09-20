import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));
const legalDir = fileURLToPath(new URL('./legal', import.meta.url));
const host = process.env.WEB_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.WEB_PORT ?? '3001', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

// Clean legal URLs. In production these are what iOS, App Store Connect, and
// Meta point at; CloudFront must rewrite them to /legal/<name>.html (see
// apps/web/landing/README.md).
const legalRoutes = {
  '/privacy': 'privacy.html',
  '/terms': 'terms.html',
  '/support': 'support.html',
  '/data-deletion': 'data-deletion.html',
};

function isInside(baseDir, filePath) {
  const base = resolve(baseDir);
  const target = resolve(filePath);
  return target === base || target.startsWith(`${base}${sep}`);
}

/**
 * Maps a URL path to { file, spaFallback }.
 * - clean legal paths -> apps/web/legal/<name>.html
 * - /legal/<file>     -> apps/web/legal/<file>
 * - paths with an extension -> apps/web/src/<path> (404 when missing)
 * - everything else   -> SPA shell (apps/web/src/index.html)
 */
function resolveRequest(urlPath) {
  const cleanPath = normalize(urlPath).replaceAll('\\', '/');
  const trimmed = cleanPath.length > 1 && cleanPath.endsWith('/') ? cleanPath.slice(0, -1) : cleanPath;

  if (legalRoutes[trimmed]) {
    return { file: join(legalDir, legalRoutes[trimmed]), baseDir: legalDir, spaFallback: false };
  }

  if (trimmed.startsWith('/legal/')) {
    return { file: join(legalDir, trimmed.slice('/legal/'.length)), baseDir: legalDir, spaFallback: false };
  }

  if (trimmed === '/' || trimmed === '') {
    return { file: join(srcDir, 'index.html'), baseDir: srcDir, spaFallback: false };
  }

  const hasExtension = extname(trimmed) !== '';
  if (hasExtension) {
    return { file: join(srcDir, trimmed), baseDir: srcDir, spaFallback: false };
  }

  return { file: join(srcDir, 'index.html'), baseDir: srcDir, spaFallback: true };
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
    const { file, baseDir } = resolveRequest(decodeURIComponent(url.pathname));

    if (!isInside(baseDir, file)) {
      response.statusCode = 403;
      response.end('Forbidden');
      return;
    }

    let data;
    try {
      data = await readFile(file);
    } catch {
      response.statusCode = 404;
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      response.end('Not found');
      return;
    }

    response.statusCode = 200;
    response.setHeader('content-type', contentTypes[extname(file)] ?? 'application/octet-stream');
    response.setHeader('cache-control', 'no-store');
    response.end(data);
  } catch (error) {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : 'Unknown server error');
  }
}).listen(port, host, () => {
  console.log(`HINTO web dev server running at http://${host}:${port}`);
});
