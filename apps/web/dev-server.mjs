import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('./src', import.meta.url));
const host = process.env.WEB_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.WEB_PORT ?? '3001', 10);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolvePath(urlPath) {
  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  return normalize(join(rootDir, cleanPath));
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
    let filePath = resolvePath(url.pathname);
    if (!filePath.startsWith(rootDir)) {
      response.statusCode = 403;
      response.end('Forbidden');
      return;
    }

    let data;
    try {
      data = await readFile(filePath);
    } catch {
      filePath = join(rootDir, 'index.html');
      data = await readFile(filePath);
    }

    response.statusCode = 200;
    response.setHeader('content-type', contentTypes[extname(filePath)] ?? 'text/plain; charset=utf-8');
    response.end(data);
  } catch (error) {
    response.statusCode = 500;
    response.end(error instanceof Error ? error.message : 'Unknown server error');
  }
}).listen(port, host, () => {
  console.log(`HINTO web dev server running at http://${host}:${port}`);
});
