import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isScaramucci, JevError } from '../src/index.js';

function stubClient(answer) {
  const calls = [];
  return {
    calls,
    async decide(req) {
      calls.push(req);
      return { is_scaramucci: answer };
    },
  };
}

test('returns computed figures and Jev verdict', async () => {
  const client = stubClient({ noul: 0.97, confidence: 0.93 });
  const result = await isScaramucci({ start: '2026-01-01', end: '2026-01-22', times: 2, client });
  assert.deepEqual(result, {
    start: '2026-01-01',
    end: '2026-01-22',
    days: 22,
    times: 2,
    scaramuccis: 2,
    jev: { noul: 0.97, confidence: 0.93 },
    verdict: true,
  });
});

test('sends Jev the range, the Scaramucci definition and one noul question', async () => {
  const client = stubClient({ noul: 0.2 });
  await isScaramucci({ start: '2026-01-01', end: '2026-01-05', times: 3, client });
  const [{ state, questions }] = client.calls;
  assert.deepEqual(state, {
    range: { start: '2026-01-01', end: '2026-01-05' },
    range_days: 5,
    scaramucci: { start: '2017-07-21', end: '2017-07-31', days: 11 },
    times: 3,
    computed_scaramuccis: 5 / 11,
  });
  assert.deepEqual(Object.keys(questions), ['is_scaramucci']);
  const q = questions.is_scaramucci;
  assert.equal(q.type, 'noul');
  assert.match(q.instructions, /2017-07-21 to 2017-07-31, 11 days/);
  assert.match(q.instructions, /at least 3 Scaramucci/);
  assert.match(q.criteria.true, /at least 3 × 11 = 33 days/);
  assert.match(q.criteria.false, /shorter than 33 days/);
});

test('fractional times does not leak float noise into the prompt', async () => {
  const client = stubClient({ noul: 0.5 });
  await isScaramucci({ start: '2026-01-01', end: '2026-01-05', times: 0.7, client });
  assert.match(client.calls[0].questions.is_scaramucci.criteria.true, /= 7\.7 days$/);
});

test('confidence is null when Jev omits it', async () => {
  const client = stubClient({ noul: 0.2 });
  const result = await isScaramucci({ start: '2026-01-01', end: '2026-01-05', client });
  assert.deepEqual(result.jev, { noul: 0.2, confidence: null });
});

test('verdict follows Jev, not local maths', async () => {
  const client = stubClient({ noul: 0.1 });
  const result = await isScaramucci({ start: '2026-01-01', end: '2026-12-31', times: 1, client });
  assert.equal(result.verdict, false);
});

test('threshold is configurable and inclusive', async () => {
  const client = stubClient({ noul: 0.7 });
  const args = { start: '2026-01-01', end: '2026-01-11', client };
  assert.equal((await isScaramucci({ ...args, threshold: 0.7 })).verdict, true);
  assert.equal((await isScaramucci({ ...args, threshold: 0.8 })).verdict, false);
});

test('times defaults to 1', async () => {
  const client = stubClient({ noul: 1 });
  const result = await isScaramucci({ start: '2026-01-01', end: '2026-01-11', client });
  assert.equal(result.times, 1);
});

const invalidInputs = {
  'times 0': { times: 0 },
  'times negative': { times: -1 },
  'times Infinity': { times: Infinity },
  'times non-number': { times: 'x' },
  'threshold NaN': { threshold: NaN },
  'threshold above 1': { threshold: 2 },
  'threshold below 0': { threshold: -0.1 },
  'bad start date': { start: 'nope' },
};
for (const [name, overrides] of Object.entries(invalidInputs)) {
  test(`rejects ${name} before calling Jev`, async () => {
    const client = stubClient({ noul: 1 });
    await assert.rejects(isScaramucci({ start: '2026-01-01', end: '2026-01-11', client, ...overrides }), RangeError);
    assert.equal(client.calls.length, 0);
  });
}

test('threshold bounds 0 and 1 are accepted', async () => {
  const args = { start: '2026-01-01', end: '2026-01-11' };
  assert.equal((await isScaramucci({ ...args, threshold: 0, client: stubClient({ noul: 0 }) })).verdict, true);
  assert.equal((await isScaramucci({ ...args, threshold: 1, client: stubClient({ noul: 0.99 }) })).verdict, false);
});

const badAnswers = {
  'missing answer': {},
  'string noul': { is_scaramucci: { noul: '0.9' } },
  'noul above 1': { is_scaramucci: { noul: 57 } },
  'noul below 0': { is_scaramucci: { noul: -3 } },
  'NaN noul': { is_scaramucci: { noul: NaN } },
};
for (const [name, answers] of Object.entries(badAnswers)) {
  test(`throws JevError on ${name}`, async () => {
    const client = { async decide() { return answers; } };
    await assert.rejects(isScaramucci({ start: '2026-01-01', end: '2026-01-11', client }), JevError);
  });
}

test('strips control characters from the payload in the error', async () => {
  const client = { async decide() { return { error: 'x\u009b2Jy' }; } };
  await assert.rejects(
    isScaramucci({ start: '2026-01-01', end: '2026-01-11', client }),
    (err) => err instanceof JevError && !/[\u0080-\u009f]/.test(err.message) && /x\?2Jy/.test(err.message),
  );
});

test('includes the unexpected payload in the error', async () => {
  const client = { async decide() { return { error: 'quota exceeded' }; } };
  await assert.rejects(
    isScaramucci({ start: '2026-01-01', end: '2026-01-11', client }),
    (err) => err instanceof JevError && /quota exceeded/.test(err.message),
  );
});

describe('client from env', () => {
  const ok = () => new Response(JSON.stringify({ is_scaramucci: { noul: 0.9, confidence: 0.8 } }));
  const recordingFetch = () => {
    const calls = [];
    return { calls, fetch: async (url, init) => (calls.push({ url, init }), ok()) };
  };
  const range = { start: '2026-01-01', end: '2026-01-11' };

  test('throws JevError mentioning TYPESAFE_API_KEY when unset', async () => {
    await assert.rejects(
      isScaramucci({ ...range, env: {} }),
      (err) => err instanceof JevError && /TYPESAFE_API_KEY/.test(err.message),
    );
  });

  test('refuses a non-https JEV_BASE_URL', async () => {
    const { calls, fetch } = recordingFetch();
    await assert.rejects(
      isScaramucci({ ...range, env: { TYPESAFE_API_KEY: 'k', JEV_BASE_URL: 'http://evil.test' }, fetch }),
      /must use https/,
    );
    assert.equal(calls.length, 0);
  });

  test('uses defaults when overrides are absent', async () => {
    const { calls, fetch } = recordingFetch();
    const result = await isScaramucci({ ...range, env: { TYPESAFE_API_KEY: 'sk-env' }, fetch });
    assert.equal(result.verdict, true);
    assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(calls[0].init.headers.authorization, 'Bearer sk-env');
    assert.equal(JSON.parse(calls[0].init.body).model, 'jev-1.13.0');
  });

  test('honours JEV_BASE_URL and JEV_MODEL', async () => {
    const { calls, fetch } = recordingFetch();
    const env = { TYPESAFE_API_KEY: 'k', JEV_BASE_URL: 'https://example.test', JEV_MODEL: 'jev-pinned' };
    await isScaramucci({ ...range, env, fetch });
    assert.equal(calls[0].url, 'https://example.test/v1/systemone');
    assert.equal(JSON.parse(calls[0].init.body).model, 'jev-pinned');
  });

  test('ignores empty overrides', async () => {
    const { calls, fetch } = recordingFetch();
    await isScaramucci({ ...range, env: { TYPESAFE_API_KEY: 'k', JEV_BASE_URL: '', JEV_MODEL: '' }, fetch });
    assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone');
  });
});
