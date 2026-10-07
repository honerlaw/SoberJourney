/**
 * Verification script for issue #31's pure conversation-cache helpers.
 *
 * packages/app has no unit-test runner, so this stands in for unit tests. Run
 * from the repo root after `npm ci` (tsx is already in the workspace):
 *
 *   npx tsx .minerva/work/2026-10-06-conversation-management/verify-conversation-management.ts
 */
import assert from "node:assert/strict";
import {
  appendToNewestPage,
  canSaveTitle,
  conversationFromPages,
  createPendingId,
  flattenConversations,
  flattenMessages,
  isPendingId,
  classifyFailedSend,
  LIST_PLACEHOLDER_TITLE,
  mergePending,
  nextConversationAfterDelete,
  nextListCursor,
  nextMessagesCursor,
  removeFromList,
  renameFieldInitialValue,
  renameInList,
  retryableMessageId,
  serverMessageIds,
  setConversationTitle,
  trimToNewestPage,
  type ConversationListPages,
  type ConversationPages,
} from "../../../packages/app/src/providers/ConversationProvider/conversationCache";
import type {
  ConversationGetOutput,
  ConversationListItem,
  ConversationListOutput,
  Message,
} from "../../../packages/app/src/providers/ConversationProvider/ConversationContext";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const msg = (id: string, role: Message["role"], content = id): Message => ({
  id,
  role,
  content,
  createdAt: new Date(0),
});

const page = (
  messages: Message[],
  nextCursor: string | null,
  title: string | null = null,
): ConversationGetOutput => ({
  conversation: {
    id: "c1",
    title,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    messages,
    nextCursor,
  },
});

const pages = (...ps: ConversationGetOutput[]): ConversationPages => ({
  pages: ps,
  pageParams: ps.map((_, i) => (i === 0 ? undefined : `cursor-${i}`)),
});

const item = (id: string, title = id): ConversationListItem => ({
  id,
  title,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const listPages = (...ps: ConversationListItem[][]): ConversationListPages => ({
  pages: ps.map(
    (conversations, i): ConversationListOutput => ({
      conversations,
      nextCursor: i < ps.length - 1 ? `n${i}` : null,
    }),
  ),
  pageParams: ps.map((_, i) => (i === 0 ? undefined : `n${i - 1}`)),
});

// pages[0] = newest page, pages[1] = older page
const twoPages = pages(
  page([msg("m3", "USER"), msg("m4", "MODEL")], "m3", "Title"),
  page([msg("m1", "USER"), msg("m2", "MODEL")], null, "Title"),
);

check(
  "flattenMessages is chronological across pages (newest page first in the cache)",
  () => {
    assert.deepEqual(
      flattenMessages(twoPages).map((m) => m.id),
      ["m1", "m2", "m3", "m4"],
    );
  },
);

check(
  "flattenMessages de-duplicates ids shifted across page boundaries",
  () => {
    const shifted = pages(
      page([msg("m2", "MODEL"), msg("m3", "USER")], "m2"),
      page([msg("m1", "USER"), msg("m2", "MODEL")], null),
    );
    assert.deepEqual(
      flattenMessages(shifted).map((m) => m.id),
      ["m1", "m2", "m3"],
    );
  },
);

check("helpers tolerate absent and empty pages", () => {
  assert.deepEqual(flattenMessages(undefined), []);
  assert.deepEqual(flattenMessages({ pages: [], pageParams: [] }), []);
  assert.equal(conversationFromPages(undefined), null);
  assert.equal(conversationFromPages({ pages: [], pageParams: [] }), null);
  assert.equal(appendToNewestPage(undefined, [msg("x", "USER")]), undefined);
  const empty = { pages: [], pageParams: [] };
  assert.equal(appendToNewestPage(empty, [msg("x", "USER")]), empty);
  assert.equal(trimToNewestPage(undefined), undefined);
  assert.equal(setConversationTitle(undefined, "x"), undefined);
  assert.deepEqual(flattenConversations(undefined), []);
  assert.equal(removeFromList(undefined, "a"), undefined);
  assert.equal(renameInList(undefined, "a", "t"), undefined);
});

check(
  "conversationFromPages takes metadata from the newest page and all messages",
  () => {
    const conversation = conversationFromPages(twoPages)!;
    assert.equal(conversation.title, "Title");
    assert.equal(conversation.messages.length, 4);
  },
);

check("appendToNewestPage appends to the end of pages[0] only", () => {
  const now = new Date(123);
  const next = appendToNewestPage(
    twoPages,
    [msg("pending-a", "USER"), msg("pending-a-reply", "MODEL")],
    now,
  )!;
  assert.deepEqual(
    next.pages[0]!.conversation.messages.map((m) => m.id),
    ["m3", "m4", "pending-a", "pending-a-reply"],
  );
  assert.equal(next.pages[1], twoPages.pages[1]);
  assert.deepEqual(next.pages[0]!.conversation.updatedAt, now);
  assert.equal(next.pageParams, twoPages.pageParams);
  assert.deepEqual(
    flattenMessages(next).map((m) => m.id),
    ["m1", "m2", "m3", "m4", "pending-a", "pending-a-reply"],
  );
});

check("trimToNewestPage keeps pages and pageParams in step", () => {
  const trimmed = trimToNewestPage(twoPages)!;
  assert.equal(trimmed.pages.length, 1);
  assert.deepEqual(trimmed.pageParams, [undefined]);
  assert.equal(trimmed.pages[0], twoPages.pages[0]);
  const single = pages(page([], null));
  assert.equal(trimToNewestPage(single), single);
});

check("setConversationTitle updates every page", () => {
  const renamed = setConversationTitle(twoPages, "Renamed")!;
  assert.deepEqual(
    renamed.pages.map((p) => p.conversation.title),
    ["Renamed", "Renamed"],
  );
});

check("cursor helpers map null/absent (older servers) to undefined", () => {
  assert.equal(nextMessagesCursor(twoPages.pages[0]!), "m3");
  assert.equal(nextMessagesCursor(twoPages.pages[1]!), undefined);
  const oldServerPage = {
    conversation: { ...twoPages.pages[1]!.conversation, nextCursor: undefined },
  } as unknown as ConversationGetOutput;
  assert.equal(nextMessagesCursor(oldServerPage), undefined);
  assert.equal(
    nextListCursor({ conversations: [] } as unknown as ConversationListOutput),
    undefined,
  );
  assert.equal(nextListCursor({ conversations: [], nextCursor: "x" }), "x");
});

check("pending ids", () => {
  const id = createPendingId();
  assert.ok(isPendingId(id));
  assert.ok(isPendingId(`${id}-reply`));
  assert.ok(!isPendingId("2f1c0f9e-0000-4000-8000-000000000000"));
});

check("mergePending: id-keyed, never duplicates, never drops", () => {
  const base = [msg("m1", "USER")];
  const pending = msg("pending-x", "USER", "hello");
  assert.deepEqual(
    mergePending(base, pending).map((m) => m.id),
    ["m1", "pending-x"],
  );
  assert.deepEqual(
    mergePending([...base, pending], pending).map((m) => m.id),
    ["m1", "pending-x"],
  );
  assert.equal(mergePending(base, undefined), base);
});

check(
  "pending bubble stays visible through trim-and-refetch of the newest page",
  () => {
    // Failed send: the bubble is pending while the newest page is refetched.
    const pending = msg("pending-x", "USER", "hello");
    const refetched = pages(
      page([msg("m3", "USER"), msg("m9", "USER", "hello")], "m3"),
    );
    const shown = mergePending(flattenMessages(refetched), pending);
    assert.ok(shown.some((m) => m.id === "pending-x"));
    assert.equal(shown[shown.length - 1]!.id, "pending-x");
  },
);

check("serverMessageIds excludes client ids", () => {
  assert.deepEqual(
    [...serverMessageIds([msg("m1", "USER"), msg("pending-a", "USER")])],
    ["m1"],
  );
});

check(
  "classifyFailedSend: a new USER row with the exact text and no reply is saved-unanswered",
  () => {
    const before = new Set(["m1", "m2"]);
    const after = [
      msg("m1", "USER"),
      msg("m2", "MODEL"),
      msg("m3", "USER", "hello"),
    ];
    assert.equal(
      classifyFailedSend(after, "hello", before),
      "saved-unanswered",
    );
  },
);

check(
  "classifyFailedSend: message and reply both stored (lost response) is answered",
  () => {
    const before = new Set(["m1"]);
    const after = [
      msg("m1", "MODEL"),
      msg("m3", "USER", "hello"),
      msg("m4", "MODEL"),
    ];
    assert.equal(classifyFailedSend(after, "hello", before), "answered");
  },
);

check(
  "classifyFailedSend: an older identical unanswered message is not-saved",
  () => {
    // m2 "hello" was saved by an earlier failed turn; this send's persist failed.
    const before = new Set(["m1", "m2"]);
    const after = [msg("m1", "MODEL"), msg("m2", "USER", "hello")];
    assert.equal(classifyFailedSend(after, "hello", before), "not-saved");
    // ... also when that older message has since been answered
    const answered = [msg("m2", "USER", "hello"), msg("m5", "MODEL")];
    assert.equal(classifyFailedSend(answered, "hello", before), "not-saved");
  },
);

check(
  "classifyFailedSend: other text, only MODEL rows, a pending id or nothing are not-saved",
  () => {
    const before = new Set<string>();
    assert.equal(
      classifyFailedSend([msg("m3", "USER", "hello!")], "hello", before),
      "not-saved",
    );
    assert.equal(
      classifyFailedSend([msg("m3", "MODEL", "hello")], "hello", before),
      "not-saved",
    );
    assert.equal(
      classifyFailedSend([msg("pending-z", "USER", "hello")], "hello", before),
      "not-saved",
    );
    assert.equal(classifyFailedSend([], "hello", before), "not-saved");
  },
);

check(
  "retryableMessageId: only a trailing saved USER message while idle",
  () => {
    assert.equal(
      retryableMessageId([msg("m1", "MODEL"), msg("m2", "USER")], false),
      "m2",
    );
    assert.equal(
      retryableMessageId([msg("m1", "MODEL"), msg("m2", "USER")], true),
      null,
    );
    assert.equal(
      retryableMessageId([msg("m1", "USER"), msg("m2", "MODEL")], false),
      null,
    );
    assert.equal(
      retryableMessageId([msg("m1", "MODEL"), msg("pending-q", "USER")], false),
      null,
    );
    assert.equal(retryableMessageId([], false), null);
  },
);

check(
  "flattenConversations keeps list order and de-duplicates rows that moved pages",
  () => {
    const data = listPages([item("a"), item("b")], [item("b"), item("c")]);
    assert.deepEqual(
      flattenConversations(data).map((c) => c.id),
      ["a", "b", "c"],
    );
  },
);

check("removeFromList and renameInList touch every page", () => {
  const data = listPages([item("a"), item("b")], [item("c")]);
  assert.deepEqual(
    flattenConversations(removeFromList(data, "b")).map((c) => c.id),
    ["a", "c"],
  );
  assert.deepEqual(
    flattenConversations(renameInList(data, "c", "New name")).map(
      (c) => c.title,
    ),
    ["a", "b", "New name"],
  );
  assert.equal(removeFromList(data, "b")!.pageParams, data.pageParams);
});

check(
  "nextConversationAfterDelete picks the most recent remaining one, else null",
  () => {
    const list = [item("a"), item("b"), item("c")];
    assert.equal(nextConversationAfterDelete(list, "a"), "b");
    assert.equal(nextConversationAfterDelete(list, "b"), "a");
    assert.equal(nextConversationAfterDelete([item("a")], "a"), null);
    assert.equal(nextConversationAfterDelete([], "a"), null);
  },
);

check(
  "rename field: placeholder prefills empty; Save needs non-blank text",
  () => {
    assert.equal(
      renameFieldInitialValue(LIST_PLACEHOLDER_TITLE, LIST_PLACEHOLDER_TITLE),
      "",
    );
    assert.equal(renameFieldInitialValue(null, "New conversation"), "");
    assert.equal(renameFieldInitialValue("Mine", "New conversation"), "Mine");
    assert.equal(canSaveTitle("   "), false);
    assert.equal(canSaveTitle(""), false);
    assert.equal(canSaveTitle(" x "), true);
  },
);

console.log(`\n${passed} checks passed`);
