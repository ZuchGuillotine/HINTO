/*
 * Deploy-time configuration for the static web app.
 *
 * Reads HINTO_API_BASE_URL (and optionally HINTO_APPLE_WEB_ENABLED) from the
 * environment and writes them into the <meta> tags in src/index.html so the
 * page can find the API without a bundler. Safe to run repeatedly; with no
 * environment variables set it leaves the file untouched.
 *
 *   HINTO_API_BASE_URL=https://api.staging.hinto.app node apps/web/inject-config.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const indexPath = fileURLToPath(new URL('./src/index.html', import.meta.url));
const apiBaseUrl = (process.env.HINTO_API_BASE_URL ?? '').trim();
const appleEnabled = (process.env.HINTO_APPLE_WEB_ENABLED ?? '').trim().toLowerCase();

function setMeta(html, name, value) {
  const pattern = new RegExp(`(<meta\\s+name="${name}"\\s+content=")[^"]*(")`, 'u');
  if (!pattern.test(html)) {
    throw new Error(`index.html is missing <meta name="${name}">`);
  }
  return html.replace(pattern, `$1${value.replaceAll('"', '&quot;')}$2`);
}

let html = await readFile(indexPath, 'utf8');
let changed = false;

if (apiBaseUrl) {
  if (!/^https?:\/\//u.test(apiBaseUrl)) {
    throw new Error(`HINTO_API_BASE_URL must start with http:// or https:// (got "${apiBaseUrl}")`);
  }
  html = setMeta(html, 'hinto-api-base-url', apiBaseUrl.replace(/\/+$/u, ''));
  changed = true;
}

if (appleEnabled === 'true' || appleEnabled === 'false') {
  html = setMeta(html, 'hinto-apple-web-enabled', appleEnabled);
  changed = true;
}

if (changed) {
  await writeFile(indexPath, html);
  console.log(`inject-config: wrote ${indexPath}`);
} else {
  console.log('inject-config: no HINTO_* environment variables set, index.html unchanged');
}
