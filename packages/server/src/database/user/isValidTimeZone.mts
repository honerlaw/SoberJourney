// IANA zone names: "UTC" or Area/Location[/Sub] (e.g. America/Argentina/Buenos_Aires).
// Raw offsets like "+05:00" are rejected on purpose, even though newer V8
// versions accept them, as downstream consumers expect IANA names.
const IANA_NAME = /^(UTC|[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)+)$/;
const MAX_LENGTH = 100;

/**
 * Whether the given value is a usable IANA timezone name.
 */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (value.length === 0 || value.length > MAX_LENGTH) {
    return false;
  }

  if (!IANA_NAME.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
