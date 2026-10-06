import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { TRPCError } from "@trpc/server";
import type { Context } from "../../../../../context.mjs";
import { MessageRole } from "../../../../../util/database.mjs";
import {
  GeminiError,
  type ChatResult,
} from "../../../../../datasource/gemini/chat.mjs";
import { type JourneyWithCheckIns } from "./utils/types.mjs";
import { BASE_SYSTEM_PROMPT } from "./utils/systemPrompt.mjs";
import { buildJourneyContext } from "./utils/buildJourneyContext.mjs";
import { buildHistory, HISTORY_MAX_MESSAGES } from "./utils/buildHistory.mjs";
import { buildCurrentTimeContext, safeTimeZone } from "./utils/timeZone.mjs";
import { SAFETY_FALLBACK_REPLY } from "./utils/fallback.mjs";
import { generateTitle } from "./utils/generateTitle.mjs";
import { withConversationLock } from "../utils/conversationLock.mjs";
import { persistMessage } from "../utils/persistMessage.mjs";
import { decryptMessages } from "../utils/decryptMessages.mjs";

const RECENT_CHECK_INS = 5;
export const MAX_OUTPUT_TOKENS = 2048;

export type SponsorChatInput = {
  conversationId: string;
  text: string;
};

export type SponsorChatOutput = {
  response: string;
  userMessageId: string;
  modelMessageId: string;
};

/**
 * One sponsor-chat turn. The user's message is persisted before the model is
 * called, so a generation failure never loses it; the reply is persisted only
 * when complete. Turns on the same conversation are serialized (best-effort,
 * see conversationLock).
 */
export async function runSponsorChat(
  ctx: Context,
  input: SponsorChatInput,
  now: () => Date = () => new Date(),
): Promise<SponsorChatOutput> {
  const user = ctx.auth.user;
  if (!user) {
    throw new UnauthorizedError();
  }

  return withConversationLock(
    input.conversationId,
    () => runTurn(ctx, user.id, user.timezone, input, now()),
    {
      onWaitTimeout: () =>
        ctx.logger.warn(
          {
            attributes: { conversationId: input.conversationId },
            tags: ["rpc", "conversation", "sponsorChat"],
          },
          "Timed out waiting for a previous turn; proceeding unserialized",
        ),
    },
  );
}

async function runTurn(
  ctx: Context,
  userId: string,
  storedTimeZone: string | null | undefined,
  input: SponsorChatInput,
  now: Date,
): Promise<SponsorChatOutput> {
  // Ownership check + the most recent history, and the user's journeys
  const [page, journeys] = await Promise.all([
    ctx.database.conversation.getMessagesPage(input.conversationId, userId, {
      limit: HISTORY_MAX_MESSAGES,
    }),
    ctx.database.journey.list(userId),
  ]);

  if (!page) {
    throw new NotFoundError("Conversation not found.");
  }

  // Persist the user's message before generating, so it survives any failure.
  const userMessage = await persistMessage(
    ctx,
    userId,
    input.conversationId,
    MessageRole.USER,
    input.text,
  );

  const [journeysWithCheckIns, previousMessages] = await Promise.all([
    Promise.all(
      journeys.map(
        async (journey): Promise<JourneyWithCheckIns> => ({
          journey,
          recentCheckIns:
            await ctx.database.conversation.getRecentCheckInEntries(
              journey.id,
              userId,
              RECENT_CHECK_INS,
            ),
        }),
      ),
    ),
    decryptMessages(ctx, page.messages),
  ]);

  const timeZone = safeTimeZone(storedTimeZone);
  const systemPrompt =
    BASE_SYSTEM_PROMPT +
    buildCurrentTimeContext(now, timeZone) +
    buildJourneyContext(journeysWithCheckIns, now, timeZone);

  const history = buildHistory([
    ...previousMessages.map((message) => ({
      role:
        message.role === MessageRole.USER
          ? ("user" as const)
          : ("model" as const),
      text: message.content,
    })),
    { role: "user" as const, text: input.text },
  ]);

  let result: ChatResult;
  try {
    result = await ctx.datasource.gemini.chat(history, {
      systemInstruction: systemPrompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
  } catch (error) {
    throw toRpcError(error);
  }

  let reply: string;
  switch (result.status) {
    case "ok":
      reply = result.text;
      break;
    case "blocked":
      reply = SAFETY_FALLBACK_REPLY;
      break;
    case "truncated":
      // Never store a cut-off reply as if it were complete.
      throw new InternalServerError(
        "The response was cut off. Please try again.",
      );
  }

  const modelMessage = await persistMessage(
    ctx,
    userId,
    input.conversationId,
    MessageRole.MODEL,
    reply,
  );

  if (result.status === "ok" && page.conversation.title === null) {
    // Fire and forget: never delays the reply, never an unhandled rejection.
    generateTitle(ctx, input.conversationId, userId, input.text).catch(
      (error: unknown) => {
        ctx.logger.error(
          {
            error,
            attributes: { conversationId: input.conversationId },
            tags: ["rpc", "conversation", "sponsorChat", "generateTitle"],
          },
          "Failed to generate conversation title",
        );
      },
    );
  }

  return {
    response: reply,
    userMessageId: userMessage.id,
    modelMessageId: modelMessage.id,
  };
}

/**
 * Maps a generation failure to a plain-message RPC error. Never UNAUTHORIZED:
 * released apps log the user out on 401.
 */
export function toRpcError(error: unknown): TRPCError {
  if (error instanceof GeminiError && error.kind === "rate_limited") {
    return new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "The sponsor is getting a lot of messages right now. Please try again in a moment.",
      cause: error,
    });
  }
  return new InternalServerError("Failed to generate response.");
}
