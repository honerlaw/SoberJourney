import type { Logger } from "./logger.mjs";
import express from "express";
import { pinoHttp } from "pino-http";
import pino from "pino";

type Options = {
  app: express.Express;
  logger: Logger;
};

export function register({ app, logger }: Options) {
  app.use(
    pinoHttp({
      logger: logger as unknown as pino.Logger,
    }),
  );
}
