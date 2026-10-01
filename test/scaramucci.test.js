import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCARAMUCCI, daysInclusive, toScaramuccis } from '../src/scaramucci.js';

test('a Scaramucci is 2017-07-21 to 2017-07-31, 11 days', () => {
  assert.deepEqual(SCARAMUCCI, { start: '2017-07-21', end: '2017-07-31', days: 11 });
});

test('the canonical tenure is exactly 1 Scaramucci', () => {
  assert.equal(daysInclusive(SCARAMUCCI.start, SCARAMUCCI.end), 11);
  assert.equal(toScaramuccis(SCARAMUCCI.start, SCARAMUCCI.end), 1);
});

test('a single day counts as 1 day', () => {
  assert.equal(daysInclusive('2026-10-01', '2026-10-01'), 1);
});

test('handles leap years', () => {
  assert.equal(daysInclusive('2024-02-28', '2024-03-01'), 3);
  assert.equal(daysInclusive('2023-02-28', '2023-03-01'), 2);
});

test('22 days is 2 Scaramuccis', () => {
  assert.equal(toScaramuccis('2026-01-01', '2026-01-22'), 2);
});

test('handles years 0000-0099 without remapping to the 1900s', () => {
  assert.equal(daysInclusive('0017-01-01', '0017-01-11'), 11);
  assert.equal(daysInclusive('0000-02-28', '0000-03-01'), 3); // year 0 is a leap year
  assert.equal(daysInclusive('0099-12-31', '0100-01-01'), 2);
});

test('rejects malformed and impossible dates', () => {
  assert.throws(() => daysInclusive('2026-13-01', '2026-12-01'), RangeError);
  assert.throws(() => daysInclusive('2026-02-30', '2026-03-01'), RangeError);
  assert.throws(() => daysInclusive('yesterday', '2026-03-01'), RangeError);
  assert.throws(() => daysInclusive(20260101, '2026-03-01'), RangeError);
});

test('rejects reversed ranges', () => {
  assert.throws(() => daysInclusive('2026-03-01', '2026-02-01'), /before start/);
});
