export const DEFAULT_BASE_URL = 'https://api.typesafe.ai';
// Pinned so verdicts don't shift when the vendor moves `jev-latest`; override with JEV_MODEL.
export const DEFAULT_MODEL = 'jev-1.13.0';
export const DEFAULT_TIMEOUT_MS = 30_000;

export class JevError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message, { cause });
    this.name = 'JevError';
    this.status = status;
  }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Shorten untrusted text for an error message and strip terminal control characters. */
export function snippet(text, max = 200) {
  return String(text).slice(0, max).replace(CONTROL_CHARS, '?');
}

/** The bearer key must only travel over HTTPS (plain HTTP is allowed for loopback testing). */
function systemOneUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new JevError(`Invalid Jev base URL ${JSON.stringify(baseUrl)}`);
  }
  const loopback = parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !loopback) {
    throw new JevError(`Jev base URL must use https (got ${parsed.protocol}//${parsed.host})`);
  }
  return `${baseUrl.replace(/\/+$/, '')}/v1/systemone`;
}

/**
 * Minimal client for the TypeSafe Jev System One API.
 * `decide()` returns the answers object keyed by question name.
 */
export function createJevClient({
  apiKey,
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_MODEL,
  fetch = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!apiKey) throw new JevError('Missing Jev API key');
  const url = systemOneUrl(baseUrl);

  async function decide({ state, questions }) {
    let response;
    let text;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, state, questions }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await response.text();
    } catch (cause) {
      if (cause?.name === 'TimeoutError') {
        throw new JevError(`Jev request to ${url} timed out after ${timeoutMs}ms`, { cause });
      }
      // Node's fetch reports "fetch failed"; the useful reason (ENOTFOUND, ECONNREFUSED, ...) is nested.
      const reason = cause?.cause?.code ?? cause?.cause?.message ?? cause?.message;
      throw new JevError(`Jev request to ${url} failed: ${reason}`, { cause });
    }

    if (!response.ok) {
      throw new JevError(`Jev API returned ${response.status}: ${snippet(text)}`, { status: response.status });
    }

    let body;
    try {
      body = JSON.parse(text);
    } catch (cause) {
      throw new JevError('Jev API returned a non-JSON response', { status: response.status, cause });
    }
    if (!body || typeof body !== 'object') {
      throw new JevError('Jev API returned an unexpected response', { status: response.status });
    }
    return body;
  }

  return { decide };
}
