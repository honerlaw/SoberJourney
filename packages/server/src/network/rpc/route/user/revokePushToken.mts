import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";
import { pushTokenInput } from "./pushTokenInput.mjs";

/**
 * Revoke the signed-in user's push token so the device stops receiving
 * reminders (e.g. on sign out from a shared device). Idempotent.
 */
export const revokePushToken = procedure
  .input(pushTokenInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    const revoked = await ctx.database.user.revokePushToken(
      ctx.auth.user.id,
      input.token,
    );

    if (revoked === null) {
      throw new InternalServerError("Failed to revoke push token.");
    }

    return {
      success: true,
      revoked,
    };
  });
