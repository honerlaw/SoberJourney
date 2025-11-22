import type { ContextRequest } from "@onerlaw/framework/backend/context";
import { createContext, type Context } from "../../context.mjs";
import { router } from "./router.mjs";
import * as trpcExpress from "@trpc/server/adapters/express";
import * as userRoutes from "./route/user/index.mjs";
import type { UserModel } from "../../util/database.mjs";

const appRouter = router({
  user: router(userRoutes),
});

export type AppRouter = typeof appRouter;

export const expressTRPCMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: async ({ req }) => {
    return await createContext(
      req as unknown as ContextRequest<UserModel, Context>,
    );
  },
});
