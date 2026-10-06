// IANA zone names, e.g. "America/Argentina/Buenos_Aires", "Etc/GMT+5", or
// single-segment names devices may report such as "GMT" / "UTC" / "Japan".
const IANA_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;
// raw offsets ("+05:00", "GMT+5", "UTC-03:00") are rejected on purpose, even
// though newer V8 versions accept some of them, as consumers expect IANA names
const OFFSET_LIKE = /^(GMT|UTC|UT)[+-]/i;
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

  if (!IANA_NAME.test(value) || OFFSET_LIKE.test(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
