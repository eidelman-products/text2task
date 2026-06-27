import "server-only";

const SECONDS_PER_MINUTE = 60;

const TRIAL_TTL_DEFAULT_SECONDS = 15 * SECONDS_PER_MINUTE;
const TRIAL_TTL_MIN_SECONDS = 5 * SECONDS_PER_MINUTE;
const TRIAL_TTL_MAX_SECONDS = 60 * SECONDS_PER_MINUTE;

const SIGNUP_CONTINUATION_TTL_DEFAULT_SECONDS = 60 * SECONDS_PER_MINUTE;
const SIGNUP_CONTINUATION_TTL_MIN_SECONDS = 15 * SECONDS_PER_MINUTE;
const SIGNUP_CONTINUATION_TTL_MAX_SECONDS = 2 * 60 * SECONDS_PER_MINUTE;

type BoundedSecondsConfig = Readonly<{
  rawValue: string | undefined;
  defaultValue: number;
  minValue: number;
  maxValue: number;
}>;

function parseEnabledFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function parseBoundedSeconds({
  rawValue,
  defaultValue,
  minValue,
  maxValue,
}: BoundedSecondsConfig): number {
  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue.trim());

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  if (parsedValue < minValue) {
    return minValue;
  }

  if (parsedValue > maxValue) {
    return maxValue;
  }

  return parsedValue;
}

export const HOMEPAGE_DEMO_TTL_BOUNDS = Object.freeze({
  trial: Object.freeze({
    defaultSeconds: TRIAL_TTL_DEFAULT_SECONDS,
    minSeconds: TRIAL_TTL_MIN_SECONDS,
    maxSeconds: TRIAL_TTL_MAX_SECONDS,
  }),
  signupContinuation: Object.freeze({
    defaultSeconds: SIGNUP_CONTINUATION_TTL_DEFAULT_SECONDS,
    minSeconds: SIGNUP_CONTINUATION_TTL_MIN_SECONDS,
    maxSeconds: SIGNUP_CONTINUATION_TTL_MAX_SECONDS,
  }),
});

export const HOMEPAGE_DEMO_CONFIG = Object.freeze({
  enabled: parseEnabledFlag(process.env.TEXT2TASK_HOMEPAGE_DEMO_ENABLED),
  trialTtlSeconds: parseBoundedSeconds({
    rawValue: process.env.TEXT2TASK_HOMEPAGE_DEMO_TRIAL_TTL_SECONDS,
    defaultValue: TRIAL_TTL_DEFAULT_SECONDS,
    minValue: TRIAL_TTL_MIN_SECONDS,
    maxValue: TRIAL_TTL_MAX_SECONDS,
  }),
  signupContinuationTtlSeconds: parseBoundedSeconds({
    rawValue:
      process.env.TEXT2TASK_HOMEPAGE_DEMO_SIGNUP_CONTINUATION_TTL_SECONDS,
    defaultValue: SIGNUP_CONTINUATION_TTL_DEFAULT_SECONDS,
    minValue: SIGNUP_CONTINUATION_TTL_MIN_SECONDS,
    maxValue: SIGNUP_CONTINUATION_TTL_MAX_SECONDS,
  }),
});

export type HomepageDemoConfig = typeof HOMEPAGE_DEMO_CONFIG;
