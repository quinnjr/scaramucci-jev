import { SCARAMUCCI, daysInclusive } from './scaramucci.js';
import { createJevClient, JevError, snippet } from './jev-client.js';

export { SCARAMUCCI, daysInclusive, toScaramuccis } from './scaramucci.js';
export { createJevClient, JevError, DEFAULT_BASE_URL, DEFAULT_MODEL } from './jev-client.js';

const QUESTION = 'is_scaramucci';

function clientFromEnv(env, fetch) {
  if (!env.TYPESAFE_API_KEY) throw new JevError('Missing Jev API key: set TYPESAFE_API_KEY');
  return createJevClient({
    apiKey: env.TYPESAFE_API_KEY,
    ...(fetch && { fetch }),
    ...(env.JEV_BASE_URL && { baseUrl: env.JEV_BASE_URL }),
    ...(env.JEV_MODEL && { model: env.JEV_MODEL }),
  });
}

/**
 * Ask Jev whether the range `start`..`end` (inclusive, YYYY-MM-DD) lasts at
 * least `times` Scaramuccis. Jev's answer is the verdict; local maths is context.
 *
 * Without `client`, one is built from `env` (TYPESAFE_API_KEY, JEV_BASE_URL, JEV_MODEL).
 */
export async function isScaramucci({
  start,
  end,
  times = 1,
  threshold = 0.5,
  client,
  env = process.env,
  fetch,
} = {}) {
  if (typeof times !== 'number' || !Number.isFinite(times) || times <= 0) {
    throw new RangeError(`times must be a positive number, got ${String(times)}`);
  }
  if (typeof threshold !== 'number' || !(threshold >= 0 && threshold <= 1)) {
    throw new RangeError(`threshold must be between 0 and 1, got ${String(threshold)}`);
  }
  const days = daysInclusive(start, end);
  const scaramuccis = days / SCARAMUCCI.days;
  const minDays = Number((times * SCARAMUCCI.days).toFixed(6));
  const jev = client ?? clientFromEnv(env, fetch);

  const answers = await jev.decide({
    state: {
      range: { start, end },
      range_days: days,
      scaramucci: { ...SCARAMUCCI },
      times,
      computed_scaramuccis: scaramuccis,
    },
    questions: {
      [QUESTION]: {
        type: 'noul',
        instructions:
          'One Scaramucci is the length of Anthony Scaramucci\'s tenure as White House Communications ' +
          `Director (${SCARAMUCCI.start} to ${SCARAMUCCI.end}, ${SCARAMUCCI.days} days). ` +
          `Is the date range at least ${times} Scaramucci(s) long?`,
        criteria: {
          true: `The range lasts at least ${times} × ${SCARAMUCCI.days} = ${minDays} days`,
          false: `The range is shorter than ${minDays} days`,
        },
      },
    },
  });

  const answer = answers?.[QUESTION];
  if (typeof answer?.noul !== 'number' || !(answer.noul >= 0 && answer.noul <= 1)) {
    throw new JevError(
      `Jev response did not include a valid noul answer for "${QUESTION}": ${snippet(JSON.stringify(answers))}`,
    );
  }

  return {
    start,
    end,
    days,
    times,
    scaramuccis,
    jev: { noul: answer.noul, confidence: typeof answer.confidence === 'number' ? answer.confidence : null },
    verdict: answer.noul >= threshold,
  };
}
