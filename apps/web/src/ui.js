/*
 * Small shared helpers for rendering. No framework, no dependencies.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatDateTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeExpiry(value) {
  if (!value) {
    return '';
  }
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return '';
  }
  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return 'ended';
  }
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 48) {
    return `${Math.floor(hours / 24)} days left`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes}m left`;
  }
  return `${Math.max(minutes, 1)} min left`;
}

export function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers: RFC4122-ish v4 from Math.random.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function readLocal(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage failures (private mode, quota). The app keeps working in memory.
  }
}

export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    const ok = document.execCommand('copy');
    helper.remove();
    return ok;
  } catch {
    return false;
  }
}

export function renderNotice(notice, { dismissAction = 'dismiss-notice' } = {}) {
  if (!notice) {
    return '';
  }
  const type = notice.type ?? 'info';
  return `
    <section class="notice notice--${escapeHtml(type)}" role="status">
      <span>${escapeHtml(notice.message)}</span>
      <span class="notice__actions">
        ${
          notice.retryAction
            ? `<button class="secondary-button" data-action="${escapeHtml(notice.retryAction)}" type="button">Retry</button>`
            : ''
        }
        <button class="ghost-button" data-action="${escapeHtml(dismissAction)}" type="button" aria-label="Dismiss">Dismiss</button>
      </span>
    </section>
  `;
}

export function renderFooter() {
  return `
    <footer class="site-footer">
      <span>&copy; ${new Date().getFullYear()} HINTO</span>
      <nav aria-label="Legal">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/support">Support</a>
        <a href="/data-deletion">Delete your data</a>
      </nav>
    </footer>
  `;
}

export function renderBrand() {
  return `<a class="brand" href="/" aria-label="HINTO home">HINTO</a>`;
}
