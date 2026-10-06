import { pino, type BaseLogger } from "pino";
import std from "pino-std-serializers";

type PinoLevels = keyof BaseLogger;

type LogObject = {
  tags: string[];
  error?: unknown;
  attributes?: {
    [key: string]: unknown;
  };
};

export type LogFn = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj: LogObject, msg?: string, ...args: any[]): void;
  (msg: string): void;
};

/**
 * Create a stricter log function type to better enforce the shape of the log object
 */
type StrictLogger = {
  [level in PinoLevels]: LogFn;
} & {
  child: (options?: object) => StrictLogger;
};

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"];

/**
 * Resolve the logger level from the environment. An explicit, valid LOG_LEVEL
 * wins; otherwise production logs at info and everything else at debug.
 * Reads process.env directly since the config util depends on the logger.
 */
export function resolveLogLevel(
  env: Record<string, string | undefined> = process.env,
): string {
  const level = env.LOG_LEVEL?.trim().toLowerCase();
  if (level && LOG_LEVELS.includes(level)) {
    return level;
  }
  return env.NODE_ENV === "production" ? "info" : "debug";
}

const loggerConfig = {
  enabled: process.env.LOG_SILENT !== "true",
  level: resolveLogLevel(),
  serializers: {
    error: std.wrapErrorSerializer((error) => {
      if (error.name === "AxiosError") {
        const toJSON = error.toJSON.bind(error);
        error.toJSON = () => ({
          ...toJSON(),
          response: {
            data: error.response?.data,
            headers: { ...error.response?.headers },
          },
        });
      }
      return error;
    }),
  },
  redact: {
    paths: [
      "req.headers",
      "req.query",
      "req.params",
      "req.remoteAddress",
      "req.remotePort",
      "res.headers",

      // don't leak data from errors
      'error.config.headers["PLAID-CLIENT-ID"]',
      'error.config.headers["PLAID-SECRET"]',
      "error.config.data",
    ],
    censor: () => {
      return undefined;
    },
  },
};

const config = loggerConfig;

const pinoLogger = pino<never, boolean>(config);

// force a simpler API
export const logger = pinoLogger as unknown as StrictLogger;

export type Logger = StrictLogger;
