import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { procedure } from "../../router.mjs";
import type { Context } from "../../../../context.mjs";

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * Delete the user's identity from Clerk. Best effort: the user's data is
 * already deleted, so a failure here is logged and never fails the request.
 */
async function removeAuthUser(ctx: Context, authId: string) {
  try {
    await ctx.datasource.clerk.client.users.deleteUser(authId);
  } catch (error) {
    if (isNotFoundError(error)) {
      ctx.logger.info(
        {
          tags: ["rpc", "user", "remove", "clerk"],
          attributes: { authId },
        },
        "Clerk user already deleted",
      );
      return;
    }

    ctx.logger.error(
      {
        error,
        tags: ["rpc", "user", "remove", "clerk"],
        attributes: { authId },
      },
      "Failed to delete Clerk user after removing user data",
    );
  }
}

export const remove = procedure.mutation(async ({ ctx }) => {
  if (!ctx.auth.user) {
    throw new UnauthorizedError();
  }

  // delete our data first, so it is always removed even if Clerk fails
  const removedUser = await ctx.database.user.remove(ctx.auth.user.id);

  if (!removedUser) {
    throw new InternalServerError("User not found or failed to remove.");
  }

  await removeAuthUser(ctx, removedUser.authId);

  return {
    success: true,
    user: {
      id: removedUser.id,
      createdAt: removedUser.createdAt,
    },
  };
});
