/**
 * One Scaramucci: Anthony Scaramucci's tenure as White House Communications
 * Director, 2017-07-21 through 2017-07-31 inclusive.
 */
export const SCARAMUCCI = Object.freeze({ start: '2017-07-21', end: '2017-07-31', days: 11 });

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a `YYYY-MM-DD` string to a UTC timestamp, rejecting impossible dates. */
function parseIsoDate(value) {
  const match = typeof value === 'string' && ISO_DATE.exec(value);
  if (!match) throw new RangeError(`Invalid date ${JSON.stringify(value)}; expected YYYY-MM-DD`);

  const [, y, m, d] = match.map(Number);
  // setUTCFullYear, unlike Date.UTC, doesn't remap years 0-99 to 1900-1999.
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  const ms = date.getTime();
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new RangeError(`Invalid date ${JSON.stringify(value)}`);
  }
  return ms;
}

/** Number of calendar days from `start` to `end`, counting both ends. */
export function daysInclusive(start, end) {
  const startMs = parseIsoDate(start);
  const endMs = parseIsoDate(end);
  if (endMs < startMs) throw new RangeError(`End date ${end} is before start date ${start}`);
  return (endMs - startMs) / MS_PER_DAY + 1;
}

/** Length of the range measured in Scaramuccis. */
export function toScaramuccis(start, end) {
  return daysInclusive(start, end) / SCARAMUCCI.days;
}
