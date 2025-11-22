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

const loggerConfig = {
  enabled: process.env.LOG_SILENT !== "true",
  level: "trace", // @todo control by env variable
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
