/**
 * Abuse limits, each overridable by an optional env var so a miscalibrated
 * limit can be relaxed in the deploy settings without a code change. A value
 * of 0 disables that control.
 *
 * Read straight from process.env, not through getConfig: a bad value here
 * must never fail the whole config (which would take the server down). An
 * unset, empty or invalid value (not a non-negative integer) uses the default.
 * Read on every use, so tests and a restart pick up changes.
 */
export const LIMIT_DEFAULTS = {
  TRPC_MAX_BATCH_SIZE: 25,
  MUTATION_LIMIT_PER_MINUTE: 60,
  MUTATION_LIMIT_PER_HOUR: 1000,
  DECRYPT_LIMIT_PER_MINUTE: 30_000,
  JOURNAL_ENTRY_QUOTA: 5000,
  JOURNEY_QUOTA: 200,
} as const;

export type LimitName = keyof typeof LIMIT_DEFAULTS;

export function getLimit(name: LimitName): number {
  const raw = process.env[name]?.trim();
  if (raw && /^\d+$/.test(raw)) {
    return Number(raw);
  }
  return LIMIT_DEFAULTS[name];
}

/**
 * On/off switches, on by default. Only "0" or "false" (any case) turns one
 * off, so a typo keeps the protection.
 */
export const SWITCH_NAMES = ["TRPC_JSON_ONLY_POSTS"] as const;

export type SwitchName = (typeof SWITCH_NAMES)[number];

export function isSwitchOn(name: SwitchName): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw !== "0" && raw !== "false";
}
