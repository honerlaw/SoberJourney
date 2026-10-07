/**
 * Pure helpers for the conversation caches. No React, no TanStack runtime:
 * verified by `.minerva/work/2026-10-06-conversation-management/verify-conversation-management.ts`.
 *
 * Shapes:
 * - A conversation's messages are a TanStack infinite query over
 *   `conversation.get` with `{ cursor, limit }`. `pages[0]` is the NEWEST page;
 *   each page's messages are chronological (oldest first). Older pages are
 *   appended as `pages[1]`, `pages[2]`, ...
 * - The drawer is an infinite query over `conversation.list`, most recently
 *   updated first.
 */
import type {
  Conversation,
  ConversationGetOutput,
  ConversationListItem,
  ConversationListOutput,
  Message,
  SponsorChatStreamEvent,
} from "./ConversationContext"

/** The subset of TanStack's `InfiniteData` these helpers read and write. */
export type Pages<TPage> = {
  pages: TPage[]
  pageParams: unknown[]
}

export type ConversationPages = Pages<ConversationGetOutput>
export type ConversationListPages = Pages<ConversationListOutput>

const PENDING_PREFIX = "pending-"

export const createPendingId = (): string =>
  `${PENDING_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** A client-side id (`pending-…`, `pending-…-reply`) not yet replaced by a server id. */
export const isPendingId = (id: string): boolean =>
  id.startsWith(PENDING_PREFIX)

/** Cursor for the next (older) page, or undefined when there is none (or an old server omits it). */
export const nextMessagesCursor = (
  page: ConversationGetOutput,
): string | undefined => page.conversation.nextCursor ?? undefined

export const nextListCursor = (
  page: ConversationListOutput,
): string | undefined => page.nextCursor ?? undefined

/** All loaded messages, chronological, de-duplicated by id (first occurrence wins). */
export function flattenMessages(
  data: ConversationPages | undefined,
): Message[] {
  if (!data?.pages?.length) return []
  const seen = new Set<string>()
  const result: Message[] = []
  for (let i = data.pages.length - 1; i >= 0; i--) {
    for (const message of data.pages[i]!.conversation.messages) {
      if (seen.has(message.id)) continue
      seen.add(message.id)
      result.push(message)
    }
  }
  return result
}

/** The conversation (title etc. from the newest page) with every loaded message. */
export function conversationFromPages(
  data: ConversationPages | undefined,
): Conversation | null {
  const newest = data?.pages?.[0]
  if (!newest?.conversation) return null
  return { ...newest.conversation, messages: flattenMessages(data) }
}

/** Appends messages to the end of the newest page. No-op without a loaded page. */
export function appendToNewestPage(
  data: ConversationPages | undefined,
  messages: Message[],
  now: Date = new Date(),
): ConversationPages | undefined {
  const newest = data?.pages?.[0]
  if (!data || !newest?.conversation) return data
  const updated: ConversationGetOutput = {
    ...newest,
    conversation: {
      ...newest.conversation,
      updatedAt: now,
      messages: [...newest.conversation.messages, ...messages],
    },
  }
  return { ...data, pages: [updated, ...data.pages.slice(1)] }
}

/**
 * Keeps only the newest page (and its page param), so a refetch is a single
 * request however far the user scrolled. Older pages reload on scroll.
 */
export function trimToNewestPage<TPage>(
  data: Pages<TPage> | undefined,
): Pages<TPage> | undefined {
  if (!data || data.pages.length <= 1) return data
  return {
    pages: data.pages.slice(0, 1),
    pageParams: data.pageParams.slice(0, 1),
  }
}

/** Sets the title on every page of a conversation's cache. */
export function setConversationTitle(
  data: ConversationPages | undefined,
  title: string | null,
): ConversationPages | undefined {
  if (!data?.pages?.length) return data
  return {
    ...data,
    pages: data.pages.map((page) =>
      page.conversation
        ? { ...page, conversation: { ...page.conversation, title } }
        : page,
    ),
  }
}

/**
 * The rendered list: cached messages plus a pending bubble whose client id is
 * not in the cache yet (id-keyed, never content-matched; see #28).
 */
export function mergePending(
  messages: Message[],
  pending: Message | undefined,
): Message[] {
  return mergePendingMessages(messages, [pending])
}

/**
 * Like `mergePending` for several pending messages (a pending user bubble and
 * the reply streaming in after it), appended in order, each only when its id
 * is not in the cache yet.
 */
export function mergePendingMessages(
  messages: Message[],
  pending: (Message | undefined)[],
): Message[] {
  const ids = new Set(messages.map((message) => message.id))
  const extra = pending.filter(
    (message): message is Message => !!message && !ids.has(message.id),
  )
  return extra.length > 0 ? [...messages, ...extra] : messages
}

/**
 * Client id of the reply to a pending send. The streaming bubble and the
 * reply appended to the cache when the stream completes share it, so the
 * list never remounts or duplicates the reply.
 */
export const replyIdFor = (clientId: string): string => `${clientId}-reply`

/** The partially streamed reply, rendered as a MODEL bubble. */
export function streamingReplyMessage(
  clientId: string,
  text: string,
  createdAt: Date,
): Message {
  return { id: replyIdFor(clientId), role: "MODEL", content: text, createdAt }
}

/** What a streamed send has produced so far. */
export type StreamState = {
  /** Server id of the user message, once the server reported it saved. */
  userMessageId: string | null
  /** Concatenated `delta` text (replaced by `done.response` at the end). */
  replyText: string
  /** The final event: the persisted reply. */
  done: {
    response: string
    userMessageId: string
    modelMessageId: string
  } | null
}

export const INITIAL_STREAM_STATE: StreamState = {
  userMessageId: null,
  replyText: "",
  done: null,
}

/**
 * Folds one stream event into the state. Order-tolerant: events can arrive
 * one by one or all at once (an edge that buffers the response), and `done`
 * always wins, its `response` replacing the streamed text (it differs when a
 * safety block turned the reply into a fallback message).
 */
export function applyStreamEvent(
  state: StreamState,
  event: SponsorChatStreamEvent,
): StreamState {
  switch (event.type) {
    case "saved":
      return { ...state, userMessageId: event.userMessageId }
    case "delta":
      if (state.done) return state
      return { ...state, replyText: state.replyText + event.text }
    case "done":
      return {
        userMessageId: event.userMessageId,
        replyText: event.response,
        done: {
          response: event.response,
          userMessageId: event.userMessageId,
          modelMessageId: event.modelMessageId,
        },
      }
  }
}

/** The streaming procedure's path (see `isMissingProcedureError`). */
export const STREAM_PROCEDURE_PATH = "conversation.streamSponsorChat"

/**
 * True for a NOT_FOUND on the streaming procedure's path before any event
 * arrived: what a server without that procedure returns (e.g. after a server
 * rollback). Only then may a send fall back to the non-streaming procedure.
 * An unknown procedure never runs, so nothing was saved and the fallback
 * cannot duplicate the message. The same code also covers the procedure's own
 * "Conversation not found." (raised before anything is saved), where the
 * fallback simply fails the same way.
 */
export function isMissingProcedureError(
  data: { code?: unknown; path?: unknown } | null | undefined,
  path: string = STREAM_PROCEDURE_PATH,
): boolean {
  return data?.code === "NOT_FOUND" && data.path === path
}

/** Server-assigned message ids currently known (client `pending-…` ids excluded). */
export function serverMessageIds(messages: Message[]): Set<string> {
  return new Set(
    messages.filter((m) => !isPendingId(m.id)).map((message) => message.id),
  )
}

/**
 * What the server kept of a send that failed on the client:
 * - "not-saved": no new copy of the message (restore the typed text);
 * - "saved-unanswered": the message is stored but has no reply (offer Retry);
 * - "answered": message and reply are both stored (the client only lost the
 *   response, e.g. a dropped connection).
 *
 * The newest USER row after the refetch counts only if its server id was not
 * known before the send and it holds the exact text the client sent, so an
 * older, identical message never counts.
 */
export type FailedSendOutcome = "not-saved" | "saved-unanswered" | "answered"

export function classifyFailedSend(
  messagesAfterRefetch: Message[],
  sentText: string,
  serverIdsBeforeSend: Set<string>,
): FailedSendOutcome {
  let index = messagesAfterRefetch.length - 1
  while (index >= 0 && messagesAfterRefetch[index]!.role === "MODEL") {
    index--
  }
  const newestUser = messagesAfterRefetch[index]
  if (
    !newestUser ||
    isPendingId(newestUser.id) ||
    serverIdsBeforeSend.has(newestUser.id) ||
    newestUser.content !== sentText
  ) {
    return "not-saved"
  }
  return index === messagesAfterRefetch.length - 1
    ? "saved-unanswered"
    : "answered"
}

/**
 * The message a "Retry" action applies to: the newest message, when it is a
 * USER message the server has stored (server id) and no send or retry is in
 * flight for the conversation. Null otherwise.
 */
export function retryableMessageId(
  messages: Message[],
  isBusy: boolean,
): string | null {
  if (isBusy) return null
  const newest = messages[messages.length - 1]
  if (!newest || newest.role !== "USER" || isPendingId(newest.id)) return null
  return newest.id
}

/** All loaded drawer entries, de-duplicated by id (first occurrence wins). */
export function flattenConversations(
  data: ConversationListPages | undefined,
): ConversationListItem[] {
  if (!data?.pages?.length) return []
  const seen = new Set<string>()
  const result: ConversationListItem[] = []
  for (const page of data.pages) {
    for (const item of page.conversations) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      result.push(item)
    }
  }
  return result
}

export function removeFromList(
  data: ConversationListPages | undefined,
  conversationId: string,
): ConversationListPages | undefined {
  if (!data?.pages?.length) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.filter((c) => c.id !== conversationId),
    })),
  }
}

export function renameInList(
  data: ConversationListPages | undefined,
  conversationId: string,
  title: string,
): ConversationListPages | undefined {
  if (!data?.pages?.length) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      conversations: page.conversations.map((c) =>
        c.id === conversationId ? { ...c, title } : c,
      ),
    })),
  }
}

/**
 * Where to go after deleting `deletedId`: the most recent remaining loaded
 * conversation (the list is most-recent first), or null for the empty state.
 */
export function nextConversationAfterDelete(
  conversations: ConversationListItem[],
  deletedId: string,
): string | null {
  return conversations.find((c) => c.id !== deletedId)?.id ?? null
}

/** Title `conversation.list` returns for an untitled conversation. */
export const LIST_PLACEHOLDER_TITLE = "New conversation"

/** Title shown in the rename field: empty for the list's untitled placeholder. */
export function renameFieldInitialValue(
  title: string | null | undefined,
  placeholder: string,
): string {
  return !title || title === placeholder ? "" : title
}

/** Mirrors the server's rename normalization closely enough to gate Save. */
export function canSaveTitle(input: string): boolean {
  return input.trim().length > 0
}
