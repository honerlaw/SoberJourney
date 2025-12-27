import { type Logger, logger } from "./util/logger/index.mjs";
import { wrap } from "@onerlaw/framework/backend/utils";
import { getConfig } from "./util/config.mjs";

import * as userDB from "./database/user/index.mjs";
import * as userKeyDB from "./database/user/key/index.mjs";
import * as userPushTokenDB from "./database/user/pushToken/index.mjs";
import * as journeyDB from "./database/journey/index.mjs";
import * as journalDB from "./database/journal/index.mjs";
import * as conversationDB from "./database/conversation/index.mjs";
import * as checkinDB from "./database/checkin/index.mjs";

import * as encryptionService from "./service/encryption/index.mjs";

import * as clerkDS from "./datasource/clerk/index.mjs";
import * as geminiDS from "./datasource/gemini/index.mjs";
import * as expoDS from "./datasource/expo/index.mjs";

import { type ContextRequest } from "@onerlaw/framework/backend/context";
import { client, type UserModel } from "./util/database.mjs";
import { getAuth, verifyToken } from "@clerk/express";
import { type RequestHandler } from "express";

const options = {
  logger,
  upsert: async (userId: string) => {
    return userDB.upsert(logger, client, userId);
  },
  create: async (
    user: UserModel | null,
    childLogger: Logger,
    additional?: { [key: string]: unknown },
  ) => {
    const { clerkClient, ...clerkDSRemaining } = clerkDS;
    const { geminiClient, ...geminiDSRemaining } = geminiDS;
    const { expoClient, ...expoDSRemaining } = expoDS;

    return {
      logger: childLogger,
      auth: {
        user,
      },
      datasource: {
        clerk: {
          client: clerkClient,
          ...wrap(clerkClient, wrap(childLogger, clerkDSRemaining)),
        },
        gemini: {
          client: geminiClient,
          ...wrap(geminiClient, wrap(childLogger, geminiDSRemaining)),
        },
        expo: {
          client: expoClient,
          ...wrap(expoClient, wrap(childLogger, expoDSRemaining)),
        },
      },
      database: {
        client,
        user: {
          ...wrap(client, wrap(childLogger, userDB)),
          key: wrap(client, wrap(childLogger, userKeyDB)),
          pushToken: wrap(client, wrap(childLogger, userPushTokenDB)),
        },
        journey: wrap(client, wrap(childLogger, journeyDB)),
        journal: wrap(client, wrap(childLogger, journalDB)),
        conversation: wrap(client, wrap(childLogger, conversationDB)),
        checkin: wrap(client, wrap(childLogger, checkinDB)),
      },
      additional: additional || {},
      service: {
        encryption: encryptionService,
      },
      clone: (
        newUser: UserModel | null,
        additional?: { [key: string]: unknown },
      ) => options.create(newUser, childLogger, additional),
    };
  },
};

export type Context = Awaited<ReturnType<(typeof options)["create"]>>;
export type CTXRequest =
  | ContextRequest<UserModel, Context>
  | string
  | undefined;

export const createContext = async (
  req?: CTXRequest,
  additional?: { [key: string]: unknown },
) => {
  // if we receive a token from clerk, we need to verify / parse it
  if (typeof req === "string") {
    try {
      const results = await verifyToken(req, {
        jwtKey: await getConfig("CLERK_JWSK"),
      });
      const userId = results.sub;
      const foundUser = await options.upsert(userId);
      return options.create(
        foundUser,
        logger.child({
          userId,
        }),
        additional,
      );
    } catch (err) {
      logger.error(
        {
          error: err,
          tags: ["context", "createContext"],
        },
        "Failed to verify token to create context.",
      );

      return options.create(null, logger, additional);
    }
  }

  // no request object or token, so just return a context without auth
  if (!req) {
    return options.create(null, logger, additional);
  }

  // its the request itself
  const { userId } = getAuth(req);
  const childLogger = userId
    ? logger.child({
        userId,
      })
    : logger;

  const foundUser = userId ? await options.upsert(userId) : null;

  return await options.create(foundUser, childLogger, additional);
};

export function contextMiddleware(): RequestHandler {
  return async (req, res, next) => {
    const unknownReq = req as unknown as CTXRequest;
    if (typeof unknownReq === "string" || !unknownReq) {
      return next();
    }
    unknownReq.serverContext = await createContext(unknownReq);
    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      serverContext: Context;
    }
  }
}
