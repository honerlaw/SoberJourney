import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";

const addPushTokenInput = z.object({
  token: z.string().min(1, "Push token is required."),
});

export const addPushToken = procedure
  .input(addPushTokenInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const pushToken = await ctx.database.user.pushToken.upsert(
      ctx.auth.user.id,
      input.token,
    );

    if (!pushToken) {
      throw new InternalServerError("Failed to add push token.");
    }

    return {
      success: true,
    };
  });
