/*
 * Runtime configuration for the HINTO web app.
 *
 * This is a classic (non-module) script so it runs before any ES module,
 * regardless of network timing. It resolves the API base URL from, in order:
 *   1. an existing `window.HINTO_API_BASE_URL` global (set by the host page)
 *   2. a `<meta name="hinto-api-base-url" content="...">` tag in index.html
 *   3. localhost / 127.0.0.1 hostname -> the local API on port 3000
 *   4. the production API host
 *
 * `window.HINTO_APPLE_WEB_ENABLED` may also be set by the host page (or the
 * `hinto-apple-web-enabled` meta tag) to reveal the Sign in with Apple button.
 */
(function configureHinto() {
  function readMeta(name) {
    var tag = document.querySelector('meta[name="' + name + '"]');
    var content = tag && tag.getAttribute('content');
    return content ? content.trim() : '';
  }

  function isLocalHostname(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  var existing =
    typeof window.HINTO_API_BASE_URL === 'string' ? window.HINTO_API_BASE_URL.trim() : '';
  var fromMeta = readMeta('hinto-api-base-url');
  var resolved = existing || fromMeta;

  if (!resolved) {
    resolved = isLocalHostname(window.location.hostname)
      ? 'http://127.0.0.1:3000'
      : 'https://api.hinto.app';
  }

  window.HINTO_API_BASE_URL = resolved.replace(/\/+$/, '');

  if (typeof window.HINTO_APPLE_WEB_ENABLED !== 'boolean') {
    window.HINTO_APPLE_WEB_ENABLED = readMeta('hinto-apple-web-enabled') === 'true';
  }

  window.HINTO_IS_LOCAL = isLocalHostname(window.location.hostname);
})();
