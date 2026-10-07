import { procedure } from "../../../router.mjs";
import { chatInput } from "./utils/types.mjs";
import { runSponsorChat } from "./runSponsorChat.mjs";

export const sponsorChat = procedure
  .input(chatInput)
  .mutation(async ({ ctx, input }) => runSponsorChat(ctx, input));
