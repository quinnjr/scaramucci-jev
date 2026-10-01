import { parseArgs } from 'node:util';
import { isScaramucci } from './index.js';

export const USAGE = `Usage: scaramucci <start> <end> [--times N] [--threshold P] [--json]

  <start> <end>     Inclusive date range, YYYY-MM-DD
  --times N         How many Scaramuccis to test for (default 1)
  --threshold P     Minimum Jev probability for YES (default 0.5)
  --json            Print the full result as JSON

Environment: TYPESAFE_API_KEY (required), JEV_BASE_URL, JEV_MODEL
`;

const plural = (n) => `Scaramucci${n === 1 ? '' : 's'}`;
const round = (n, places = 2) => Number(n.toFixed(places));

/** Strict decimal parse: `Number()` would turn '' into 0 and accept '0x10'. */
function parseNumberFlag(name, value) {
  if (!/^\s*\d+(\.\d+)?\s*$/.test(value)) {
    throw new RangeError(`--${name} must be a number, got ${JSON.stringify(value)}`);
  }
  return Number(value);
}

export function format(r) {
  return (
    `${r.start} → ${r.end}: ${r.days} days = ${round(r.scaramuccis)} ${plural(r.scaramuccis)}. ` +
    `Is it ≥ ${r.times} ${plural(r.times)}? Jev says ${r.verdict ? 'YES' : 'NO'} (p=${round(r.jev.noul)})`
  );
}

export async function main(argv, { client, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        times: { type: 'string', default: '1' },
        threshold: { type: 'string', default: '0.5' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });

    if (values.help) {
      stdout(USAGE);
      return 0;
    }
    if (positionals.length !== 2) throw new Error(`expected <start> and <end>\n\n${USAGE}`);

    const [start, end] = positionals;
    const result = await isScaramucci({
      start,
      end,
      times: parseNumberFlag('times', values.times),
      threshold: parseNumberFlag('threshold', values.threshold),
      client,
    });
    stdout(values.json ? `${JSON.stringify(result, null, 2)}\n` : `${format(result)}\n`);
    return 0;
  } catch (err) {
    stderr(`error: ${err.message}\n`);
    return 1;
  }
}
