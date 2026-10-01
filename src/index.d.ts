export interface ScaramucciUnit {
  readonly start: string;
  readonly end: string;
  readonly days: number;
}

/** 2017-07-21 → 2017-07-31 inclusive: 11 days. */
export const SCARAMUCCI: ScaramucciUnit;

/** Calendar days from `start` to `end` (YYYY-MM-DD), counting both ends. Throws RangeError. */
export function daysInclusive(start: string, end: string): number;

/** Length of the range in Scaramuccis. Throws RangeError. */
export function toScaramuccis(start: string, end: string): number;

export const DEFAULT_BASE_URL: string;
export const DEFAULT_MODEL: string;

export class JevError extends Error {
  constructor(message: string, options?: { status?: number; cause?: unknown });
  readonly name: 'JevError';
  /** HTTP status, when the error came from an HTTP response. */
  readonly status: number | undefined;
}

export interface JevQuestion {
  type: 'noul' | 'choice' | 'score';
  instructions: string;
  criteria?: Record<string, string>;
}

export interface JevAnswer {
  noul?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
  [key: string]: unknown;
}

export interface JevClient {
  decide(request: { state: unknown; questions: Record<string, JevQuestion> }): Promise<Record<string, JevAnswer>>;
}

export interface JevClientOptions {
  apiKey: string;
  /** Must be https (http allowed for localhost). Default https://api.typesafe.ai */
  baseUrl?: string;
  /** Default jev-1.13.0 */
  model?: string;
  fetch?: typeof globalThis.fetch;
  /** Default 30000 */
  timeoutMs?: number;
}

export function createJevClient(options: JevClientOptions): JevClient;

export interface IsScaramucciOptions {
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, inclusive */
  end: string;
  /** Scaramuccis to test for. Default 1. */
  times?: number;
  /** Minimum Jev probability for a true verdict, 0–1. Default 0.5. */
  threshold?: number;
  /** Explicit client; otherwise built from `env`. */
  client?: JevClient;
  /** Reads TYPESAFE_API_KEY, JEV_BASE_URL, JEV_MODEL. Default process.env. */
  env?: Record<string, string | undefined>;
  /** fetch for the env-built client. */
  fetch?: typeof globalThis.fetch;
}

export interface ScaramucciResult {
  start: string;
  end: string;
  days: number;
  times: number;
  scaramuccis: number;
  jev: { noul: number; confidence: number | null };
  verdict: boolean;
}

export function isScaramucci(options: IsScaramucciOptions): Promise<ScaramucciResult>;
