/**
 * Builds the `pg` pool config handed to `PrismaPg`.
 *
 * Without `DATABASE_CA_CERT` the config is exactly what it always was:
 * `{ connectionString: `${DATABASE_URL}` }`.
 *
 * With `DATABASE_CA_CERT` (a PEM, e.g. DigitalOcean's `${db.CA_CERT}`), the
 * pool verifies the server certificate against that CA (and the hostname, via
 * Node's default `checkServerIdentity`). pg merges the parsed connection
 * string OVER the config object, and pg-connection-string turns any
 * `sslmode` / `sslcert` / `sslkey` / `sslrootcert` / `ssl` query param into its
 * own `ssl` value, so those params are removed from the URL; otherwise a
 * `?sslmode=require` would silently replace our `ssl` object with `{}` and drop
 * the CA. With the CA set, `sslmode=disable` / `no-verify` are intentionally
 * overridden to verified TLS.
 *
 * Hostname checking needs a DNS host in DATABASE_URL (DigitalOcean's are): for
 * an IP-literal host pg sends no servername, so Node checks the certificate
 * against a fallback name instead of the IP.
 */

import { X509Certificate } from "node:crypto";

// shaped like process.env (reads DATABASE_URL and DATABASE_CA_CERT)
type DatabaseEnv = Record<string, string | undefined>;

export type PgConfig =
  | { connectionString: string }
  | {
      connectionString: string;
      ssl: { ca: string; rejectUnauthorized: true };
    };

// every query param pg-connection-string (2.9.x) derives `ssl` from. Re-check
// this list whenever pg / pg-connection-string is upgraded; the guard test in
// __tests__/databaseConfig.test.mts feeds every libpq ssl* key through pg.
const SSL_PARAMS = new Set([
  "ssl",
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "uselibpqcompat",
]);

const PEM_MARKER = "-----BEGIN CERTIFICATE-----";
const PEM_BLOCK =
  /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;

function decodeKey(rawKey: string): string | null {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/**
 * Removes the SSL-related query params from a connection string. Everything
 * before `?`, every kept `&`-segment and any `#fragment` stay byte-identical
 * (no URL re-serialisation, so passwords and encoded values are untouched).
 */
export function stripSslParams(connectionString: string): string {
  const hashIndex = connectionString.indexOf("#");
  const beforeHash =
    hashIndex === -1 ? connectionString : connectionString.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : connectionString.slice(hashIndex);

  const queryIndex = beforeHash.indexOf("?");
  if (queryIndex === -1) {
    return connectionString;
  }

  const base = beforeHash.slice(0, queryIndex);
  const kept = beforeHash
    .slice(queryIndex + 1)
    .split("&")
    .filter((segment) => {
      if (segment === "") {
        return false;
      }
      const eq = segment.indexOf("=");
      const key = decodeKey(eq === -1 ? segment : segment.slice(0, eq));
      return key === null || !SSL_PARAMS.has(key);
    });

  return `${base}${kept.length > 0 ? `?${kept.join("&")}` : ""}${fragment}`;
}

/**
 * Normalises a PEM from an env var: trims, and accepts literal `\n` escapes
 * and CRLF line endings. Returns null when unset or blank.
 */
export function normalizeCaCert(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const pem = value
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
  if (pem === "") {
    return null;
  }
  if (!pem.includes(PEM_MARKER)) {
    throw new Error(
      `DATABASE_CA_CERT is set but is not a PEM certificate (missing "${PEM_MARKER}")`,
    );
  }
  // Node's TLS layer silently ignores a corrupt CA and every connection then
  // fails as "unable to verify"; parse each block so a bad paste fails at boot
  const blocks = pem.match(PEM_BLOCK) ?? [];
  if (blocks.length === 0) {
    throw new Error(
      "DATABASE_CA_CERT is set but has no complete PEM certificate block",
    );
  }
  for (const block of blocks) {
    try {
      new X509Certificate(block);
    } catch {
      throw new Error(
        "DATABASE_CA_CERT is set but contains an unparseable certificate",
      );
    }
  }
  return pem;
}

export function buildPgConfig(env: DatabaseEnv): PgConfig {
  const connectionString = `${env.DATABASE_URL}`;
  const ca = normalizeCaCert(env.DATABASE_CA_CERT);

  if (ca === null) {
    return { connectionString };
  }

  return {
    connectionString: stripSslParams(connectionString),
    ssl: { ca, rejectUnauthorized: true },
  };
}
