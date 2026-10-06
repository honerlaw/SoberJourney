import { type Logger, logger } from "./util/logger/index.mjs";
import { wrap } from "@onerlaw/framework/backend/utils";
import { getConfig } from "./util/config.mjs";

import * as userDB from "./database/user/index.mjs";
import * as userKeyDB from "./database/user/key/index.mjs";
import * as journeyDB from "./database/journey/index.mjs";
import * as journalDB from "./database/journal/index.mjs";
import * as conversationDB from "./database/conversation/index.mjs";
import * as checkinDB from "./database/checkin/index.mjs";
import * as notificationDB from "./database/notification/index.mjs";
import * as notificationPushTokenDB from "./database/notification/pushToken/index.mjs";
import * as notificationScheduleDB from "./database/notification/schedule/index.mjs";

import * as encryptionService from "./service/encryption/index.mjs";

import * as clerkDS from "./datasource/clerk/index.mjs";
import * as geminiDS from "./datasource/gemini/index.mjs";
import * as expoDS from "./datasource/expo/index.mjs";

import { type ContextRequest } from "@onerlaw/framework/backend/context";
import { client, type UserModel } from "./util/database.mjs";
import { getAuth, verifyToken } from "@clerk/express";
import { isValidTimeZone } from "./database/user/isValidTimeZone.mjs";

const TIMEZONE_HEADER = "x-iana-time-zone";

const options = {
  logger,
  upsert: async (userId: string, timezone?: string) => {
    return userDB.upsert(logger, client, userId, timezone);
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
        },
        notification: {
          ...wrap(client, wrap(childLogger, notificationDB)),
          pushToken: wrap(client, wrap(childLogger, notificationPushTokenDB)),
          schedule: wrap(client, wrap(childLogger, notificationScheduleDB)),
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
      // When only a token string is provided, we don't have access to headers
      // so we leave the stored timezone untouched
      const foundUser = await options.upsert(userId, undefined);
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

  // Only trust a valid IANA timezone header; anything else is ignored so the
  // stored timezone is kept (and the request is never rejected for it)
  const headerTimezone = req.headers[TIMEZONE_HEADER];
  const timezone = isValidTimeZone(headerTimezone) ? headerTimezone : undefined;

  const foundUser = userId ? await options.upsert(userId, timezone) : null;

  return await options.create(foundUser, childLogger, additional);
};
