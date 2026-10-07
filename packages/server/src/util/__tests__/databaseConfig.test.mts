import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  buildPgConfig,
  normalizeCaCert,
  stripSslParams,
} from "../databaseConfig.mjs";

// pg's own parser (the version @prisma/adapter-pg actually runs), used to
// prove what the pool really ends up with after pg merges the connection
// string over the config object.
type Params = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
  options?: string;
  ssl: unknown;
};
const require = createRequire(import.meta.url);
const ConnectionParameters = require("pg/lib/connection-parameters.js") as new (
  config: object,
) => Params;

const CA = [
  "-----BEGIN CERTIFICATE-----",
  "MIIBszCCAVmgAwIBAgIUTEST",
  "-----END CERTIFICATE-----",
].join("\n");

const BASE = "postgresql://doadmin:secret@db.example.com:25060/defaultdb";

describe("buildPgConfig", () => {
  describe("without DATABASE_CA_CERT", () => {
    it("returns exactly the legacy config", () => {
      const url = `${BASE}?sslmode=require`;
      assert.deepStrictEqual(buildPgConfig({ DATABASE_URL: url }), {
        connectionString: url,
      });
    });

    it("keeps the legacy `${undefined}` coercion when DATABASE_URL is unset", () => {
      assert.deepStrictEqual(buildPgConfig({}), {
        connectionString: "undefined",
      });
    });

    it("treats blank / whitespace-only as unset", () => {
      const url = `${BASE}?sslmode=require`;
      for (const value of ["", "   ", "\n\t "]) {
        assert.deepStrictEqual(
          buildPgConfig({ DATABASE_URL: url, DATABASE_CA_CERT: value }),
          { connectionString: url },
        );
      }
    });
  });

  describe("with DATABASE_CA_CERT", () => {
    const urls = [
      `${BASE}?sslmode=require`,
      `${BASE}?sslmode=disable`,
      `${BASE}?sslmode=verify-full`,
      `${BASE}?sslmode=no-verify`,
      `${BASE}?ssl=true`,
      `${BASE}?ssl=0`,
      `${BASE}?sslrootcert=/nonexistent/ca.crt`,
      `${BASE}?uselibpqcompat=true&sslmode=require`,
      `${BASE}?sslmode=require&connection_limit=5`,
      BASE,
    ];

    for (const url of urls) {
      it(`pg ends up verifying against the CA for ${url.slice(BASE.length) || "(no query)"}`, () => {
        const config = buildPgConfig({
          DATABASE_URL: url,
          DATABASE_CA_CERT: CA,
        });
        assert.deepStrictEqual(config, {
          connectionString: stripSslParams(url),
          ssl: { ca: CA, rejectUnauthorized: true },
        });

        const params = new ConnectionParameters(config);
        assert.deepStrictEqual(params.ssl, {
          ca: CA,
          rejectUnauthorized: true,
        });
      });
    }

    it("the unstripped URL would lose the CA (why stripping exists)", () => {
      const params = new ConnectionParameters({
        connectionString: `${BASE}?sslmode=require`,
        ssl: { ca: CA, rejectUnauthorized: true },
      });
      // pg-connection-string's `ssl: {}` wins the Object.assign merge
      assert.deepStrictEqual(params.ssl, {});
    });

    it("accepts a PEM with escaped newlines or CRLF", () => {
      for (const value of [
        CA.replace(/\n/g, "\\n"),
        CA.replace(/\n/g, "\r\n"),
        CA.replace(/\n/g, "\\r\\n"),
        `  ${CA}\n\n`,
      ]) {
        const config = buildPgConfig({
          DATABASE_URL: BASE,
          DATABASE_CA_CERT: value,
        });
        assert.ok("ssl" in config);
        assert.equal(config.ssl.ca, CA);
      }
    });

    it("passes a multi-certificate bundle through", () => {
      const bundle = `${CA}\n${CA}`;
      assert.equal(normalizeCaCert(bundle), bundle);
    });

    it("throws a clear error for a non-PEM value", () => {
      assert.throws(
        () => buildPgConfig({ DATABASE_URL: BASE, DATABASE_CA_CERT: "oops" }),
        /DATABASE_CA_CERT is set but is not a PEM certificate/,
      );
    });
  });
});

describe("stripSslParams", () => {
  it("leaves everything but the SSL params byte-identical", () => {
    const cases: Array<[string, string]> = [
      // no query string
      [BASE, BASE],
      // every param stripped: no dangling ? or &
      [`${BASE}?sslmode=require&ssl=true`, BASE],
      // valueless key
      [`${BASE}?sslmode&schema=public`, `${BASE}?schema=public`],
      // pg-connection-string keys are case-sensitive, so SSLMODE has no SSL effect
      [`${BASE}?SSLMODE=require`, `${BASE}?SSLMODE=require`],
      // malformed escape in a key does not throw and is kept
      [`${BASE}?bad%zzkey=1&sslmode=require`, `${BASE}?bad%zzkey=1`],
      // percent-encoded key
      [`${BASE}?ssl%6Dode=require&a=1`, `${BASE}?a=1`],
      // empty segments dropped
      [`${BASE}?&sslmode=require&&a=1&`, `${BASE}?a=1`],
      // fragment preserved
      [`${BASE}?sslmode=require&a=1#frag`, `${BASE}?a=1#frag`],
      [`${BASE}#frag`, `${BASE}#frag`],
      // encoded values in other params are not re-encoded
      [
        `${BASE}?options=-c%20search_path%3Dfoo&sslmode=require&schema=a%2Bb`,
        `${BASE}?options=-c%20search_path%3Dfoo&schema=a%2Bb`,
      ],
    ];
    for (const [input, expected] of cases) {
      assert.equal(stripSslParams(input), expected, input);
    }
  });

  it("does not change what pg parses for user/password/host/port/database/options", () => {
    const urls = [
      // password containing @ : / % #
      "postgresql://doadmin:p%40ss%3Aw%2Fo%25rd%23x@db.example.com:25060/defaultdb?sslmode=require&connection_limit=5&schema=public",
      // bracketed IPv6 host
      "postgresql://u:pw@[::1]:5432/db?sslmode=require&options=-c%20search_path%3Dfoo",
      "postgres://u:pw@private-db.example.com:25060/defaultdb?ssl=true&sslmode=require",
    ];
    const pick = (p: Params) => ({
      user: p.user,
      password: p.password,
      host: p.host,
      port: p.port,
      database: p.database,
      options: p.options,
    });
    for (const url of urls) {
      const before = pick(new ConnectionParameters({ connectionString: url }));
      const after = pick(
        new ConnectionParameters({ connectionString: stripSslParams(url) }),
      );
      assert.deepStrictEqual(after, before, url);
    }
  });
});
