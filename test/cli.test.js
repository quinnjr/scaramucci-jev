import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/cli.js';

function harness(answer = { noul: 0.97, confidence: 0.9 }) {
  const out = [];
  const err = [];
  return {
    out,
    err,
    io: {
      client: { async decide() { return { is_scaramucci: answer }; } },
      stdout: (s) => out.push(s),
      stderr: (s) => err.push(s),
    },
  };
}

test('prints a human verdict', async () => {
  const h = harness();
  const code = await main(['2026-01-01', '2026-03-01', '--times', '5'], h.io);
  assert.equal(code, 0);
  assert.equal(
    h.out.join(''),
    '2026-01-01 → 2026-03-01: 60 days = 5.45 Scaramuccis. Is it ≥ 5 Scaramuccis? Jev says YES (p=0.97)\n',
  );
});

test('says NO and uses singular for 1 Scaramucci', async () => {
  const h = harness({ noul: 0.03 });
  await main(['2026-01-01', '2026-01-05'], h.io);
  assert.match(h.out.join(''), /≥ 1 Scaramucci\? Jev says NO \(p=0\.03\)/);
});

test('--json prints the result object', async () => {
  const h = harness();
  await main(['2026-01-01', '2026-01-22', '--times=2', '--json'], h.io);
  const result = JSON.parse(h.out.join(''));
  assert.equal(result.scaramuccis, 2);
  assert.equal(result.verdict, true);
});

const failures = [
  { argv: ['2026-03-01'], err: /^error: .*usage/is },
  { argv: ['2026-03-01', '2026-01-01'], err: /before start/ },
  { argv: ['2026-01-01', '2026-01-11', '--times', 'abc'], err: /--times must be a number, got "abc"/ },
  { argv: ['2026-01-01', '2026-01-11', '--times', '0x10'], err: /--times must be a number/ },
  { argv: ['2026-01-01', '2026-01-11', '--threshold='], err: /--threshold must be a number, got ""/ },
  { argv: ['2026-01-01', '2026-01-11', '--threshold', '1e0'], err: /--threshold must be a number/ },
  { argv: ['2026-01-01', '2026-01-11', '--times', '0'], err: /times must be a positive number/ },
  { argv: ['--bogus'], err: /unknown option/i },
];
for (const { argv, err } of failures) {
  test(`exits 1 for ${JSON.stringify(argv)}`, async () => {
    const h = harness();
    assert.equal(await main(argv, h.io), 1);
    assert.match(h.err.join(''), err);
    assert.equal(h.out.length, 0);
  });
}

test('--threshold changes the verdict', async () => {
  const h = harness({ noul: 0.97 });
  assert.equal(await main(['2026-01-01', '2026-01-11', '--threshold', '0.99'], h.io), 0);
  assert.match(h.out.join(''), /Jev says NO/);
});

for (const flag of ['--help', '-h']) {
  test(`${flag} prints usage`, async () => {
    const h = harness();
    assert.equal(await main([flag], h.io), 0);
    assert.match(h.out.join(''), /Usage: scaramucci/);
  });
}
