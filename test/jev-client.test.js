import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJevClient, JevError } from '../src/jev-client.js';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function stubFetch(response) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return typeof response === 'function' ? response() : response;
  };
  return { fetch, calls };
}

const questions = { q: { type: 'noul', instructions: 'Is it?' } };

test('posts to TypeSafe systemone with bearer auth and model', async () => {
  const { fetch, calls } = stubFetch(jsonResponse({ q: { noul: 0.9, confidence: 0.8 } }));
  const client = createJevClient({ apiKey: 'sk-test', fetch });
  await client.decide({ state: { a: 1 }, questions });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.authorization, 'Bearer sk-test');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: 'jev-1.13.0', state: { a: 1 }, questions });
});

test('honours baseUrl (trailing slash) and model overrides', async () => {
  const { fetch, calls } = stubFetch(jsonResponse({ q: { noul: 1 } }));
  const client = createJevClient({ apiKey: 'k', baseUrl: 'https://example.test/', model: 'jev-1.13', fetch });
  await client.decide({ state: 's', questions });
  assert.equal(calls[0].url, 'https://example.test/v1/systemone');
  assert.equal(JSON.parse(calls[0].init.body).model, 'jev-1.13');
});

test('returns top-level answers', async () => {
  const { fetch } = stubFetch(jsonResponse({ q: { noul: 0.97, confidence: 0.93 } }));
  const answers = await createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions });
  assert.deepEqual(answers, { q: { noul: 0.97, confidence: 0.93 } });
});

test('returns the body as-is, even with a question named "answers"', async () => {
  const body = { answers: { noul: 0.4 } };
  const { fetch } = stubFetch(jsonResponse(body));
  const answers = await createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions });
  assert.deepEqual(answers, body);
});

test('sends an abort signal with the request', async () => {
  const { fetch, calls } = stubFetch(jsonResponse({ q: { noul: 1 } }));
  await createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('times out with JevError', async () => {
  const fetch = (url, { signal }) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch, timeoutMs: 10 }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && /timed out after 10ms/.test(err.message),
  );
});

test('throws JevError when the API key is missing, without naming an env var', () => {
  assert.throws(
    () => createJevClient({ apiKey: '' }),
    (err) => err instanceof JevError && err.message === 'Missing Jev API key',
  );
});

for (const baseUrl of ['http://api.typesafe.ai', 'http://example.test:8080', 'ftp://example.test']) {
  test(`refuses to send the key to ${baseUrl}`, () => {
    assert.throws(() => createJevClient({ apiKey: 'k', baseUrl }), (err) => err instanceof JevError && /must use https/.test(err.message));
  });
}

test('rejects an unparseable base URL', () => {
  assert.throws(() => createJevClient({ apiKey: 'k', baseUrl: 'not a url' }), /Invalid Jev base URL/);
});

for (const baseUrl of ['http://localhost:8787', 'http://127.0.0.1', 'http://[::1]:9000/']) {
  test(`allows plain http for loopback ${baseUrl}`, async () => {
    const { fetch, calls } = stubFetch(jsonResponse({ q: { noul: 1 } }));
    await createJevClient({ apiKey: 'k', baseUrl, fetch }).decide({ state: 's', questions });
    assert.match(calls[0].url, /^http:\/\/.*\/v1\/systemone$/);
  });
}

test('strips terminal control characters from error bodies', async () => {
  const { fetch } = stubFetch(new Response('bad\u001b]52;c;cGF3bmVk\u0007\u009bgateway', { status: 502 }));
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && !/[\u0000-\u001f\u007f-\u009f]/.test(err.message) && /bad\?\]52/.test(err.message),
  );
});

test('throws JevError with status on non-2xx', async () => {
  const { fetch } = stubFetch(jsonResponse({ error: 'nope' }, 401));
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && err.status === 401 && /401/.test(err.message),
  );
});

test('throws JevError on non-JSON response', async () => {
  const { fetch } = stubFetch(new Response('<html>', { status: 200 }));
  await assert.rejects(createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }), JevError);
});

test('throws JevError on JSON that is not an object', async () => {
  for (const raw of ['null', '42', '"str"']) {
    const { fetch } = stubFetch(new Response(raw, { status: 200 }));
    await assert.rejects(
      createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
      (err) => err instanceof JevError && /unexpected response/.test(err.message),
      raw,
    );
  }
});

test('truncates long error bodies', async () => {
  const { fetch } = stubFetch(new Response('x'.repeat(1000), { status: 500 }));
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && err.status === 500 && err.message.length < 250,
  );
});

test('surfaces the nested network error code', async () => {
  const fetch = async () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }) });
  };
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && /api\.typesafe\.ai.*ENOTFOUND/.test(err.message),
  );
});

test('wraps network failures in JevError', async () => {
  const fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(
    createJevClient({ apiKey: 'k', fetch }).decide({ state: 's', questions }),
    (err) => err instanceof JevError && /fetch failed/.test(err.message),
  );
});
