# Proposal: sponsor-chat-client

**Date**: 2026-10-06
**Status**: Draft
**Closes**: #28

## Goal

Fix the Sponsor chat client so every send renders exactly one user bubble and one reply, pending/sending state never leaks across conversations, typed text is never lost, and init / load failures are recoverable, plus the UX polish items listed in #28. Client-only (`packages/app`), working against both the current production server and the server after #25 merges.

## Why

GitHub issue #28 (audit epic #34). Root causes, all in `packages/app`:

1. Duplicate bubbles: the optimistic-clear check compares `msg.role === "user"` while the server returns Prisma enum `"USER"` (`ConversationProvider.tsx:70,160`); `Message.role` is `string` so TS missed it. Reconciliation is also content-based, so server sanitization or a repeated "ok" breaks it.
2. `pendingMessage` / `isSending` / `isThinking` are provider-global: switching conversations mid-send leaks the bubble, "Thinking...", input lock.
3. `ChatInput` clears before send resolves; failure loses the text.
4. Init `getOrCreate` failure leaves `isInitializing` true forever; init effect depends on `handleError` identity (fresh each render) so it can re-run and snap selection back.
5. `conversation.list` never invalidated after send; `isThinking` includes background refetches; `conversation.get` errors render as the empty view.
6. Every send refetches + re-decrypts the whole conversation.

Folds in unit 001's client-side scope (id-keyed optimistic echo with no content matching; init runs once; ChatInput keeps text until send resolves and restores on failure). 001's `useToastError` memoization is NOT taken: `hooks/useToastError` belongs to #29.

## Approach

All changes inside #28's file ownership: `providers/ConversationProvider/**`, `components/pages/SponsorPage/**`, `components/ConversationDrawerContent/**`, `app/(auth)/(drawer)/**`. No server changes; no new npm dependencies.

**Types.** `ConversationContext.tsx` derives `Message`, `Conversation`, `ConversationListItem` from `inferRouterOutputs<AppRouter>` (same `AppRouter` type import TRPCProvider uses), so `role` is `"USER" | "MODEL"` and `createdAt` is a `Date` (superjson on both links). Client-only pending messages use the same `Message` type. Titles differ by route: `get` returns `title: string | null`, while `list` returns a `"New conversation"` fallback. The client never assumes they match. The header uses `get`'s nullable title, falling back to "Sponsor", which equals the static layout value. The drawer uses the list title.

**Freshness model (no per-send refetch).** `conversation.get` runs with a per-query `staleTime: Infinity` and a stable `enabled: !!conversationId` (never toggled). With an infinite staleTime, mount, focus and reconnect never refetch it on their own. Freshness is explicit:
- `selectConversation(id)` refetches that conversation's `get` only when it already has cached data (first open is served by the normal initial fetch) **and no send for it is pending**.
- Retry refetches.
- A failed send refetches.

So a send issues zero `conversation.get` requests. Nothing can refetch a conversation mid-send either. On a post-#25 server, which persists the user message before generation, such a refetch would return the server copy next to the pending bubble. `cancelQueries(get(X))` at send start aborts any fetch already in flight. Trade-off, deliberate: an open conversation does not refresh on focus/reconnect (changes from another device appear on the next select); the drawer list keeps the default freshness.

**Per-conversation pending sends.** The single source of truth is provider state `pendingByConversation: Record<conversationId, { clientId, userMessage }>`, mirrored into a ref for synchronous reads. That ref is the provider-side double-send guard: a second send for X while X is pending is rejected. ChatInput adds its own `sendingRef`. `isSending` and `isThinking` are exposed for the *current* conversation only, derived from that map. They no longer come from `useMutation().isPending`, and `isThinking` no longer includes `isRefetching`.

**Send flow (id-keyed).** `sendMessage(text): Promise<boolean>` resolves `true` on success and `false` on failure, and never rejects.
1. Guard: reject if X is pending (checked via the ref) or no conversation is loaded. The input is only rendered once `get(X)` has data, so a cache entry always exists at send time. Set `clientId = "pending-" + random`, add `{ clientId, userMessage }` to the map, and call `cancelQueries(get(X))`.
2. On success, in one synchronous block:
   - Append to the cache: `setQueryData(get(X), old => old?.conversation && { conversation: { ...old.conversation, updatedAt: new Date(), messages: [...old.conversation.messages, { id: clientId, role: "USER", content, createdAt }, { id: clientId + "-reply", role: "MODEL", content: response.response, createdAt: new Date() }] } })`.
   - Then remove the map entry. There is no invalidation and no refetch.

   The rendered list is `cache ∪ pending-whose-clientId-is-not-in-cache`. The user message enters the cache under the **same** clientId, so the render order doesn't matter: TanStack batches the query-cache notification separately from the React state update, and whichever renders first, there's never a duplicate and never a frame without the bubble. The dedupe protects only that id coordination. It never compares content and never expects a server id to equal a clientId. Server ids and sanitized text arrive on the next explicit refetch, the next time that conversation is opened.
3. If the cache entry has unexpectedly been garbage-collected by success time, keep the pending entry and `await refetchQueries(get(X))`. On either server version the server then holds both messages. Remove the pending entry only after that, so there is no gap.
4. Invalidate `conversation.list` on success. The title is generated async server-side, so if the conversation's `get` title was `null` before the send, invalidate the list again after ~3 s and ~8 s (bounded to two tries). The timers are tracked in a ref and cleared on unmount.
5. On failure:
   - remove the map entry;
   - set `failedDrafts[X] = text` in provider state;
   - call `handleError` through a ref;
   - refetch `get(X)`, because a post-#25 server may have persisted the user message before generation failed, and the refetch shows it;
   - return `false`.

   There is no double toast: TRPCProvider's global mutation `onError` only handles auth/logout and shows no toast.
6. Only the existing `response.response` field is read. Any additive field #25 adds, such as a persisted user message id, is ignored, so the client is correct against both servers.

**ChatInput.** SponsorPage keys it by `conversationId`, so local state resets on a conversation switch.
- **Send contract:** the text stays visible, with the input disabled, while `onSend` is pending. On `true` it clears the text and refocuses on web. On `false` it keeps the text.
- **Failure restore across remounts** (the user switches away mid-send and back, or the send fails while away): an effect watches `failedDrafts[conversationId]`. If the local text is empty it restores the draft; otherwise it keeps the current text. Either way it clears the entry. A remounted instance always has empty text, because the input is disabled while the send is pending.
- **Input:** `maxLength={16000}`. Multiline `TextArea` with a small min height and a capped max height.
- **Keys:** on web, `onKeyPress` (react-native-web passes the DOM keyboard event, which carries `shiftKey` and `nativeEvent.isComposing`, verified in `react-native-web/dist/exports/TextInput`; `onSubmitEditing` is not used since it does not fire for multiline) with `key === "Enter" && !shiftKey && !isComposing` calls `preventDefault()` and sends, and Shift+Enter inserts a newline. Mobile-browser users also get Enter-to-send, which is accepted. On native the return key inserts a newline and the Send button sends; the `returnKeyType="send"` key is dropped deliberately.
- **a11y:** labels on the input and the Send button.

**Init.** Init is lazy and runs once:
- The provider exposes `initialize()`, which is idempotent via a ref, so StrictMode double effects are safe. SponsorPage calls it from a mount effect that depends only on that stable function.
- `dashboard` is the initial tab, bottom tabs mount lazily, and the drawer is only reachable from the Sponsor header. So users who never open Sponsor trigger no `getOrCreate` call and get no empty conversation.
- The `getOrCreate` result is applied only if no conversation is selected yet (functional setState), so it can't snap a user selection back.
- `handleError` is read through a ref, so no effect depends on its identity. That stays correct whether or not #29 memoizes it.
- A failure sets `initError`, and SponsorPage shows an error view with Retry. `retryInitialize` resets the ref and the error.
- `isInitializing` is true only while init is running, or on Sponsor before it first resolves. It is false once `initError` is set.

**Load errors.** `conversation.get` errors are exposed as `conversationError`, with no retry on `NOT_FOUND`. SponsorPage renders an error view. For not-found it offers "Start a new conversation" (`createConversation`); for other errors, Retry (refetch).

**New Conversation reuse.** `createConversation` reuses the current conversation when it is loaded, has 0 messages and no pending send. In that case there is no `create` call and the drawer just closes.

**SponsorPage.** The scroll timeout is cleared on cleanup. The header title is set via `useNavigation().setOptions({ headerTitle })` in an effect keyed on the title, which is the conversation's `get` title or "Sponsor". `ThinkingIndicator` gets `accessibilityLiveRegion="polite"`, `role="status"` and a label.

**MessageBubble.** It checks `role === "USER"`. User messages render as plain selectable `Text`; model messages keep markdown.

**Drawer.** The active conversation is highlighted: `RenderItem` compares against `conversationId` and sets `accessibilityRole="button"` and `accessibilityState={{ selected }}`.

**Dead code.** Delete `SponsorPage/hooks/useSendMessage` after grepping for importers (none expected). Leave `CustomEventSource` and the subscription link in place; streaming (#33) decides their fate.

**Android keyboard offset.** `app.json` has `edgeToEdgeEnabled: true` and sets no `softwareKeyboardLayoutMode` anywhere. Under edge-to-edge, Android no longer resizes the window for the keyboard, so the manual `keyboardHeight - tabBarHeight` padding is the intended mechanism. There is no code change. This is not claimed as resolved; it is listed as a device check in the PR body.

## Success criteria

Automated (local, mandatory):
- `npm run build` passes (server tsc + prisma generate + app `tsc --noEmit`) and `npm run test` passes. `npx expo lint` in packages/app reports no new errors in touched files.
- `git diff --name-only origin/epic/audit-wave-1...HEAD` lists only paths under `packages/app/src/providers/ConversationProvider/`, `packages/app/src/components/pages/SponsorPage/`, `packages/app/src/components/ConversationDrawerContent/`, `packages/app/src/app/(auth)/(drawer)/` and `.minerva/`.
- `grep` confirms all of the following:
  - no `role === "user"` and no content-equality reconciliation in the provider;
  - `Message` derives from `inferRouterOutputs`;
  - no importer of `useSendMessage` remains, and its directory is gone.
- The provider reads no field of the `sponsorChat` response other than `response`. In the send-success path it never calls `invalidateQueries` / `refetchQueries` on `conversation.get`, apart from the cache-gone fallback.

Manual (no app test runner; listed in the PR body as steps for iOS, Android and web):
- **Single bubble per send:**
  - A send renders exactly one user bubble and one reply, including when the same text is sent twice (the post-#25 failed-generation limitation in Open Questions excepted).
  - The network inspector shows no `conversation.get` request after a successful send.
  - A rapid double tap or double Enter sends once.
- **Switching conversations mid-send:**
  - The other conversation shows no pending bubble, no "Thinking..." and an enabled input.
  - Switching back shows the pending bubble until the reply lands, then exactly one user bubble and one reply.
- **Failures and errors:**
  - A send failure (airplane mode) keeps the typed text in the input, including after switching away and back mid-send.
  - An offline launch on Sponsor shows an error with Retry instead of an infinite spinner. Retry recovers once online.
  - A deleted or foreign conversation id shows the not-found state with "Start a new conversation".
- **Drawer and init:**
  - The drawer title and order update after the first message of a new conversation, with the title appearing within ~10 s.
  - A background refetch or app focus doesn't flash "Thinking...".
  - Opening the Sponsor tab issues one `getOrCreate`; using only the other tabs issues none.
  - New Conversation on an empty current conversation doesn't create another one.
- **UI polish:**
  - The input is multiline. On web, Enter sends and Shift+Enter adds a newline.
  - User messages render as plain text.
  - The active conversation is highlighted in the drawer.
  - The header shows the conversation title.
- **Android keyboard:** the input sits directly above the keyboard, with no gap and no overlap. Record the device result.

## Open Questions

- Nothing blocking.
- Known limitation, stated in the PR body: on a post-#25 server, a failed generation leaves the user message persisted. The client then shows that message **and** restores the draft, so re-sending duplicates the user message server-side. This cannot happen on the current server, which persists only after generation. Deduplicating it is left to streaming (#33) and #31.
