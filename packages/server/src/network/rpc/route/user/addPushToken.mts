import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";
import { pushTokenInput } from "./pushTokenInput.mjs";

export const addPushToken = procedure
  .input(pushTokenInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const pushToken = await ctx.database.notification.pushToken.upsert(
      ctx.auth.user.id,
      input.token,
    );

    if (!pushToken) {
      throw new InternalServerError("Failed to add push token.");
    }

    // an explicit re-registration by the signed-in user means the token is
    // live for them again (e.g. sign out revoked it, then they signed back in)
    if (pushToken.revoked) {
      await ctx.database.user.reactivatePushToken(
        ctx.auth.user.id,
        input.token,
      );
    }

    return {
      success: true,
    };
  });
