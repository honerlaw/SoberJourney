import {
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { type Content } from "@google/genai";
import { TRPCError } from "@trpc/server";
import type { Context } from "../../../../../context.mjs";
import {
  MessageRole,
  type ConversationMessageModel,
  type UserJourneyModelWithEntries,
} from "../../../../../util/database.mjs";
import {
  GeminiError,
  type ChatResult,
} from "../../../../../datasource/gemini/chat.mjs";
import { type JourneyWithCheckIns } from "./utils/types.mjs";
import { BASE_SYSTEM_PROMPT } from "./utils/systemPrompt.mjs";
import { buildJourneyContext } from "./utils/buildJourneyContext.mjs";
import { buildHistory, HISTORY_MAX_MESSAGES } from "./utils/buildHistory.mjs";
import { buildCurrentTimeContext, safeTimeZone } from "./utils/timeZone.mjs";
import { fallbackReplyFor } from "./utils/fallback.mjs";
import { containsCodeFence, guardReply } from "./utils/replyGuard.mjs";
import { generateTitle } from "./utils/generateTitle.mjs";
import { withConversationLock } from "../utils/conversationLock.mjs";
import { consumeChatRateLimit } from "../utils/chatRateLimit.mjs";
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
  consumeChatRateLimit(user.id);

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
  const turn = await startTurn(ctx, userId, storedTimeZone, input, now);
  const reply = await generateReply(ctx, turn.params);

  return {
    response: reply.response,
    userMessageId: turn.userMessageId,
    modelMessageId: reply.modelMessageId,
  };
}

export type StartedTurn = {
  userMessageId: string;
  params: GenerateReplyParams;
};

export type StartTurnOptions = {
  // Checked right before persisting: when aborted, nothing is persisted and
  // the abort reason is thrown.
  signal?: AbortSignal;
  // Called right after the user's message is persisted.
  onSaved?: (userMessageId: string) => void;
};

/**
 * The first half of a sponsor-chat turn, shared by sponsorChat and
 * streamSponsorChat (callers hold the conversation lock): ownership check,
 * persist the user's message, then read history and check-ins.
 */
export async function startTurn(
  ctx: Context,
  userId: string,
  storedTimeZone: string | null | undefined,
  input: SponsorChatInput,
  now: Date,
  options: StartTurnOptions = {},
): Promise<StartedTurn> {
  // Ownership check (and the title), plus the user's journeys
  const [conversationCheck, journeys] = await Promise.all([
    ctx.database.conversation.getMessagesPage(input.conversationId, userId, {
      limit: 1,
    }),
    ctx.database.journey.list(userId),
  ]);

  if (!conversationCheck) {
    throw new NotFoundError("Conversation not found.");
  }
  const conversationTitle = conversationCheck.conversation.title;

  options.signal?.throwIfAborted();

  // Persist the user's message before generating, so it survives any failure.
  const userMessage = await persistMessage(
    ctx,
    userId,
    input.conversationId,
    MessageRole.USER,
    input.text,
  );
  options.onSaved?.(userMessage.id);

  // History is read after persisting, so even an unserialized concurrent turn
  // (lock wait timed out, or another instance) sees every committed user row.
  const [journeysWithCheckIns, page] = await Promise.all([
    loadCheckIns(ctx, userId, journeys),
    ctx.database.conversation.getMessagesPage(input.conversationId, userId, {
      limit: HISTORY_MAX_MESSAGES + 1,
    }),
  ]);

  if (!page) {
    throw new NotFoundError("Conversation not found.");
  }

  return {
    userMessageId: userMessage.id,
    params: {
      userId,
      storedTimeZone,
      conversationId: input.conversationId,
      conversationTitle,
      current: { id: userMessage.id, text: input.text },
      rows: page.messages,
      journeysWithCheckIns,
      now,
    },
  };
}

export async function loadCheckIns(
  ctx: Context,
  userId: string,
  journeys: UserJourneyModelWithEntries[],
): Promise<JourneyWithCheckIns[]> {
  return Promise.all(
    journeys.map(
      async (journey): Promise<JourneyWithCheckIns> => ({
        journey,
        recentCheckIns: await ctx.database.conversation.getRecentCheckInEntries(
          journey.id,
          userId,
          RECENT_CHECK_INS,
        ),
      }),
    ),
  );
}

export type GenerateReplyParams = {
  userId: string;
  storedTimeZone: string | null | undefined;
  conversationId: string;
  conversationTitle: string | null;
  // The already-persisted user message this reply answers.
  current: { id: string; text: string };
  // Recent rows (chronological), possibly including `current`.
  rows: ConversationMessageModel[];
  journeysWithCheckIns: JourneyWithCheckIns[];
  now: Date;
};

/**
 * Generates and persists the reply to an already-persisted user message.
 * Shared by sponsorChat (right after persisting) and retrySponsorChat (for a
 * message saved by an earlier, failed turn). Never persists a user message.
 */
export async function generateReply(
  ctx: Context,
  params: GenerateReplyParams,
): Promise<{ response: string; modelMessageId: string }> {
  const generation = await buildGeneration(ctx, params);

  let result: ChatResult;
  try {
    result = await ctx.datasource.gemini.chat(generation.history, {
      systemInstruction: generation.systemInstruction,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
  } catch (error) {
    throw toRpcError(error);
  }

  return finishReply(ctx, params, result);
}

export type Generation = {
  history: Content[];
  systemInstruction: string;
};

/**
 * Builds the Gemini request for a reply: the decrypted history (current
 * message last) and the system prompt with time and journey context.
 */
export async function buildGeneration(
  ctx: Context,
  params: GenerateReplyParams,
): Promise<Generation> {
  const { current } = params;

  // The current message goes last; earlier rows (including our own, which is
  // re-appended from its text) come from the database.
  const previousMessages = await decryptMessages(
    ctx,
    params.rows.filter((message) => message.id !== current.id),
  );

  const timeZone = safeTimeZone(params.storedTimeZone);
  const systemInstruction =
    BASE_SYSTEM_PROMPT +
    buildCurrentTimeContext(params.now, timeZone) +
    buildJourneyContext(params.journeysWithCheckIns, params.now, timeZone);

  const history = buildHistory([
    ...previousMessages.map((message) => ({
      role:
        message.role === MessageRole.USER
          ? ("user" as const)
          : ("model" as const),
      text: message.content,
    })),
    { role: "user" as const, text: current.text },
  ]);

  return { history, systemInstruction };
}

/**
 * Turns a generation result into the stored reply: ok text through the reply
 * guard (fenced code is never delivered), a blocked response as its fallback
 * reply, a truncated one as an error (never stored) unless it contains fenced
 * code, which gets the guarded reply instead. Persists the MODEL message once
 * and starts title generation for an untitled conversation.
 */
export async function finishReply(
  ctx: Context,
  params: GenerateReplyParams,
  result: ChatResult,
): Promise<{ response: string; modelMessageId: string }> {
  const { userId, conversationId, current } = params;

  let reply: string;
  switch (result.status) {
    case "ok":
      reply = guardReply(result.text);
      break;
    case "blocked":
      reply = fallbackReplyFor(result.reason);
      break;
    case "truncated":
      // A code dump that ran out of tokens gets the guarded reply, not an
      // error the user would retry.
      if (containsCodeFence(result.text)) {
        reply = guardReply(result.text);
        break;
      }
      // Never store a cut-off reply as if it were complete.
      throw new InternalServerError(
        "The response was cut off. Please try again.",
      );
  }

  if (result.status !== "blocked" && reply !== result.text) {
    ctx.logger.warn(
      {
        attributes: { conversationId, status: result.status },
        tags: ["rpc", "conversation", "sponsorChat", "replyGuard"],
      },
      "Replaced a reply containing fenced code",
    );
  }

  const modelMessage = await persistMessage(
    ctx,
    userId,
    conversationId,
    MessageRole.MODEL,
    reply,
  );

  // "" is treated like null: an empty title is never shown to users as-is.
  if (result.status === "ok" && !params.conversationTitle) {
    // Fire and forget: never delays the reply, never an unhandled rejection.
    generateTitle(ctx, conversationId, userId, current.text).catch(
      (error: unknown) => {
        ctx.logger.error(
          {
            error,
            attributes: { conversationId },
            tags: ["rpc", "conversation", "sponsorChat", "generateTitle"],
          },
          "Failed to generate conversation title",
        );
      },
    );
  }

  return { response: reply, modelMessageId: modelMessage.id };
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
