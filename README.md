# scaramucci-jev

**Is this date range at least X Scaramuccis long?** Ask a decision model to settle it.

![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-blue)
![Types included](https://img.shields.io/badge/types-included-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

```console
$ pnpm scaramucci 2026-01-01 2026-03-01 --times 5
2026-01-01 → 2026-03-01: 60 days = 5.45 Scaramuccis. Is it ≥ 5 Scaramuccis? Jev says YES (p=0.98)
```

---

## What is a Scaramucci?

A **Scaramucci** is a unit of time equal to Anthony Scaramucci's tenure as White House
Communications Director:

| | |
|---|---|
| **Start** | 2017-07-21 (appointment announced) |
| **End** | 2017-07-31 (removed from the post) |
| **Length** | **11 days**, counting both ends |

Some ready-made conversions:

| Duration | Days | Scaramuccis |
|---|---:|---:|
| The original tenure | 11 | 1.00 |
| A two-week holiday | 14 | 1.27 |
| A 90-day probation period | 90 | 8.18 |
| Calendar year 2026 | 365 | 33.18 |
| Leap year 2028 | 366 | 33.27 |
| One US presidential term (2017-01-20 → 2021-01-19) | 1,461 | 132.82 |

## How it works

This package measures the range itself, but the final call doesn't come from local maths.
The **source of truth** is [Jev](https://jevapi.dev/), TypeSafe AI's decision model. Jev
returns typed answers instead of free text. For each range, the library asks it one `noul`
question, which means "does this statement hold?", and Jev answers with a probability.

```
  start, end, times
          │
          ▼
 ┌──────────────────┐   rejects bad input before any network call
 │ validate & count │   (RangeError)
 └────────┬─────────┘
          │  days = 60, scaramuccis = 5.45
          ▼
 ┌──────────────────┐   POST https://api.typesafe.ai/v1/systemone
 │    ask Jev       │   Authorization: Bearer $TYPESAFE_API_KEY
 └────────┬─────────┘
          │  { noul: 0.98, confidence: 0.95 }
          ▼
 ┌──────────────────┐
 │ verdict = noul ≥ │   default threshold 0.5
 │    threshold     │
 └──────────────────┘
```

Here is the exact request for `2026-01-01 → 2026-03-01, times 5`:

```json
{
  "model": "jev-1.13.0",
  "state": {
    "range": { "start": "2026-01-01", "end": "2026-03-01" },
    "range_days": 60,
    "scaramucci": { "start": "2017-07-21", "end": "2017-07-31", "days": 11 },
    "times": 5,
    "computed_scaramuccis": 5.454545454545454
  },
  "questions": {
    "is_scaramucci": {
      "type": "noul",
      "instructions": "One Scaramucci is the length of Anthony Scaramucci's tenure as White House Communications Director (2017-07-21 to 2017-07-31, 11 days). Is the date range at least 5 Scaramucci(s) long?",
      "criteria": {
        "true": "The range lasts at least 5 × 11 = 55 days",
        "false": "The range is shorter than 55 days"
      }
    }
  }
}
```

The local figures go to Jev as context, but **the verdict is Jev's**. If Jev disagrees with
the arithmetic, Jev wins. The JSON output keeps `scaramuccis` and `jev.noul` side by side, so
you can see both.

## Requirements

- **Node.js 20 or later.** The package uses the built-in `fetch`, `AbortSignal.timeout` and `node:test`.
- **pnpm.** The version is pinned in `package.json` (`packageManager`), so Corepack will select it.
- **A TypeSafe API key** for anything that asks Jev. Pure date maths (`toScaramuccis`,
  `daysInclusive`) works offline without one.

## Quick start

```sh
git clone <this repo> && cd scaramucci-jev
pnpm install                     # no runtime dependencies; this just sets up the workspace
export TYPESAFE_API_KEY=sk-...

pnpm scaramucci 2017-07-21 2017-07-31
# 2017-07-21 → 2017-07-31: 11 days = 1 Scaramucci. Is it ≥ 1 Scaramucci? Jev says YES (p=0.97)
```

To make `scaramucci` available as a command anywhere, install the checkout globally. pnpm
links it, so later edits take effect straight away:

```sh
pnpm add --global "$PWD"         # run `pnpm setup` first if pnpm's global bin isn't on your PATH
scaramucci 2026-01-01 2026-12-31 --times 30
```

## Command-line usage

```
scaramucci <start> <end> [--times N] [--threshold P] [--json]
```

| Argument / option | Meaning | Default |
|---|---|---|
| `<start>` `<end>` | Inclusive date range, `YYYY-MM-DD` | required |
| `--times N` | How many Scaramuccis to test for. May be fractional, e.g. `2.5` | `1` |
| `--threshold P` | Minimum Jev probability (0–1) that counts as YES | `0.5` |
| `--json` | Print the full result object instead of a sentence | off |
| `-h`, `--help` | Show usage | |

Numbers must be plain decimals. Values like `""`, `abc`, `0x10` and `1e1` are rejected
rather than quietly turned into something else.

### Examples

```console
$ pnpm scaramucci 2026-01-01 2026-03-01 --times 6
2026-01-01 → 2026-03-01: 60 days = 5.45 Scaramuccis. Is it ≥ 6 Scaramuccis? Jev says NO (p=0.02)

$ pnpm scaramucci 2026-01-01 2026-01-11 --threshold 0.99
2026-01-01 → 2026-01-11: 11 days = 1 Scaramucci. Is it ≥ 1 Scaramucci? Jev says NO (p=0.97)

$ pnpm --silent scaramucci 2017-07-21 2017-07-31 --json
{
  "start": "2017-07-21",
  "end": "2017-07-31",
  "days": 11,
  "times": 1,
  "scaramuccis": 1,
  "jev": {
    "noul": 0.97,
    "confidence": 0.95
  },
  "verdict": true
}
```

The second example shows that the threshold is a real setting. Jev was 97% sure, which falls
short of the 99% required, so the answer is NO.

### Exit codes

| Code | When |
|---|---|
| `0` | Jev answered. This holds for a YES **and** for a NO. Read the verdict from the output. |
| `1` | Bad arguments, an invalid date range, a missing API key, or any Jev/API failure. The message goes to stderr as `error: …`. |

## Library usage

```js
import { isScaramucci, toScaramuccis } from 'scaramucci-jev';

// Offline: pure date maths, no API key needed
toScaramuccis('2026-01-01', '2026-01-22'); // → 2

// Ask Jev. Reads TYPESAFE_API_KEY (and optional overrides) from process.env
const result = await isScaramucci({ start: '2026-01-01', end: '2026-03-01', times: 5 });

if (result.verdict) {
  console.log(`Jev is ${Math.round(result.jev.noul * 100)}% sure that's at least 5 Scaramuccis`);
}
```

### `isScaramucci(options) → Promise<ScaramucciResult>`

| Option | Type | Default | Notes |
|---|---|---|---|
| `start`, `end` | `string` | required | `YYYY-MM-DD`, both ends included |
| `times` | `number` | `1` | Must be finite and greater than 0 |
| `threshold` | `number` | `0.5` | Between 0 and 1, inclusive. The verdict is `noul >= threshold` |
| `client` | `JevClient` | built from `env` | Pass your own (see `createJevClient`) |
| `env` | `Record<string, string>` | `process.env` | Where `TYPESAFE_API_KEY`, `JEV_BASE_URL` and `JEV_MODEL` are read |
| `fetch` | `typeof fetch` | global `fetch` | Used by the client built from `env`. Handy for proxies and tests |

The promise resolves to:

```ts
{
  start: string;            // as given
  end: string;
  days: number;             // inclusive day count
  times: number;
  scaramuccis: number;      // days / 11, unrounded
  jev: {
    noul: number;           // Jev's probability that the range is ≥ times Scaramuccis
    confidence: number | null;  // null when Jev doesn't report one
  };
  verdict: boolean;         // noul >= threshold
}
```

### `createJevClient(options) → JevClient`

Builds a reusable client for TypeSafe's System One endpoint. Use it when you want explicit
configuration instead of environment variables:

```js
import { createJevClient, isScaramucci } from 'scaramucci-jev';

const client = createJevClient({
  apiKey: process.env.MY_SECRET_STORE_KEY,
  model: 'jev-latest',   // track the vendor's latest model instead of the pinned default
  timeoutMs: 5_000,
});

await isScaramucci({ start: '2026-01-01', end: '2026-12-31', times: 33, client });
```

| Option | Default |
|---|---|
| `apiKey` | required |
| `baseUrl` | `https://api.typesafe.ai`. Must be `https:` (plain `http:` is allowed only for `localhost`, `127.0.0.1` and `[::1]`) |
| `model` | `jev-1.13.0` |
| `fetch` | `globalThis.fetch` |
| `timeoutMs` | `30000` |

`client.decide({ state, questions })` is a general wrapper around Jev. It sends any `noul`,
`choice` or `score` questions and returns the answers object keyed by question name, so
you can use it for decisions that have nothing to do with Scaramuccis.

### Other exports

| Export | What it is |
|---|---|
| `SCARAMUCCI` | `{ start: '2017-07-21', end: '2017-07-31', days: 11 }` (frozen) |
| `daysInclusive(start, end)` | Calendar days between two `YYYY-MM-DD` dates, counting both ends |
| `toScaramuccis(start, end)` | `daysInclusive(start, end) / 11` |
| `JevError` | Thrown for every API-side failure. Has `.status` (HTTP status, if any) and `.cause` |
| `DEFAULT_BASE_URL`, `DEFAULT_MODEL` | The defaults above |

### TypeScript

Type declarations ship in `src/index.d.ts` and are wired up through `package.json`
`exports`, so there is nothing extra to install:

```ts
import { isScaramucci, type ScaramucciResult } from 'scaramucci-jev';
const r: ScaramucciResult = await isScaramucci({ start: '2026-01-01', end: '2026-03-01' });
```

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `TYPESAFE_API_KEY` | yes | | Bearer token for the Jev API |
| `JEV_BASE_URL` | no | `https://api.typesafe.ai` | Point at a different deployment or a local mock |
| `JEV_MODEL` | no | `jev-1.13.0` | Model to ask. The default is **pinned** so verdicts don't change when TypeSafe moves `jev-latest`; set `JEV_MODEL=jev-latest` to follow it |

Empty values count as unset.

## Errors

Input problems are caught **before** any request is sent. Everything that goes wrong on the
API side becomes a single error type.

| Error | Example message | Cause |
|---|---|---|
| `RangeError` | `Invalid date "2026-02-30"` | Malformed or impossible date |
| `RangeError` | `End date 2026-01-01 is before start date 2026-03-01` | Reversed range |
| `RangeError` | `times must be a positive number, got 0` | Bad `times` |
| `RangeError` | `threshold must be between 0 and 1, got 2` | Bad `threshold` |
| `JevError` | `Missing Jev API key: set TYPESAFE_API_KEY` | No key in the environment |
| `JevError` | `Jev base URL must use https (got http://example.com)` | Insecure `JEV_BASE_URL` |
| `JevError` | `Jev request to https://…/v1/systemone failed: ENOTFOUND` | Network failure, including the underlying cause |
| `JevError` | `Jev request to https://…/v1/systemone timed out after 30000ms` | No response within `timeoutMs` |
| `JevError` | `Jev API returned 401: …` | HTTP error (`err.status === 401`) |
| `JevError` | `Jev response did not include a valid noul answer for "is_scaramucci": …` | The API replied with something other than a probability between 0 and 1 |

```js
import { isScaramucci, JevError } from 'scaramucci-jev';

try {
  await isScaramucci({ start, end, times });
} catch (err) {
  if (err instanceof RangeError) showValidationError(err.message);
  else if (err instanceof JevError && err.status === 429) retryLater();
  else throw err;
}
```

## Security notes

- **The API key only travels over HTTPS.** A non-loopback `http://` base URL is refused
  before any request is made.
- **The key is never put in error messages, logs or output.**
- **Text from the server is cleaned before it reaches your terminal.** Error bodies are cut
  to 200 characters and stripped of control characters, so a hostile or spoofed endpoint
  can't inject terminal escape sequences.
- **User input can't steer the prompt.** Dates must match `YYYY-MM-DD` exactly and `times` must
  be a number, so nothing free-form ends up in the question sent to Jev.
- **No runtime dependencies**, so there's no third-party code in the request path.

## Development

```sh
pnpm install
pnpm test            # 74 tests, well under a second, fully offline
```

The tests replace `fetch` with a stub and never contact the real API. They cover the date
maths (leap years, years 0–99, impossible dates), the HTTP contract, every error path, the
CLI, and the real `bin/` executable started as a child process.

To try the full CLI without a real key, run any small server that answers
`POST /v1/systemone` with `{"is_scaramucci":{"noul":0.9}}`, then:

```sh
TYPESAFE_API_KEY=dev JEV_BASE_URL=http://localhost:8787 pnpm scaramucci 2026-01-01 2026-03-01
```

### Project layout

```
bin/scaramucci.js     CLI entry point (sets the exit code)
src/cli.js            argument parsing and output formatting
src/index.js          isScaramucci: validation, the Jev question, verdict
src/jev-client.js     HTTP client for Jev's System One API
src/scaramucci.js     the unit and pure date maths
src/index.d.ts        TypeScript declarations
test/                 node:test suites, one per module plus a bin smoke test
```

## FAQ

**Why 11 days and not 10?**
Both the first and the last day are counted. Scaramucci was in the role on 21 July and still
on 31 July, so 31 − 21 + 1 = 11. Every range in this package is inclusive in the same way:
`2026-10-01 → 2026-10-01` is 1 day.

**What about time zones?**
There aren't any. Dates are calendar days handled in UTC, so daylight-saving changes can't
create a 23- or 25-hour "day".

**Why ask an AI at all, when it's just division?**
Because that's the brief: Jev is the source of truth. The arithmetic is shown next to Jev's
verdict, so any disagreement is visible. If you only need the maths, `toScaramuccis` makes
no network call.

**Does it cost anything?**
Each `isScaramucci` call makes exactly one Jev request, and it's small: a few hundred input
tokens. Check TypeSafe's current pricing for the rate. `toScaramuccis` and `daysInclusive`
never make a request.

**Can I use OpenRouter or another Jev host?**
Set `JEV_BASE_URL` to any HTTPS host that serves the same `/v1/systemone` contract, with
answers at the top level, and set `JEV_MODEL` to that host's model ID.

## License

[MIT](./LICENSE) © 2026 Joseph R. Quinn
