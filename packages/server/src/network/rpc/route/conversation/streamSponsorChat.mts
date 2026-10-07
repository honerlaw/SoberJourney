import { procedure } from "../../router.mjs";
import { chatInput } from "./sponsorChat/utils/types.mjs";
import { runStreamSponsorChat } from "./sponsorChat/runStreamSponsorChat.mjs";

// New procedure (no released app calls it). Same input as `sponsorChat`; the
// output is streamed (tRPC JSONL via httpBatchStreamLink) as
// `saved` → `delta`* → `done` events. `signal` aborts when the client goes
// away, which cancels generation (see runStreamSponsorChat).
export const streamSponsorChat = procedure
  .input(chatInput)
  .mutation(({ ctx, input, signal }) =>
    runStreamSponsorChat(ctx, input, signal),
  );
