import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/scaramucci.js', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: {} });

test('bin --help exits 0 with usage', () => {
  const { status, stdout } = run('--help');
  assert.equal(status, 0);
  assert.match(stdout, /Usage: scaramucci/);
});

test('bin with missing args exits 1', () => {
  const { status, stderr } = run();
  assert.equal(status, 1);
  assert.match(stderr, /^error: expected <start> and <end>/);
});

test('bin without an API key exits 1 before any network call', () => {
  const { status, stderr } = run('2026-01-01', '2026-01-11');
  assert.equal(status, 1);
  assert.match(stderr, /TYPESAFE_API_KEY/);
});
