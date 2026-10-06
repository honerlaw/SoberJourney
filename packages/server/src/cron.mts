import { createContext } from "./context.mjs";
import {
  notify as notifyCron,
  receipts as receiptsCron,
  runWithLock,
} from "./cron/index.mjs";

async function notify() {
  const ctx = await createContext();

  try {
    await runWithLock(ctx, async (assertLockHeld) => {
      const now = new Date();

      // for previously run notifications, check the pending ones to get the final results
      await receiptsCron(ctx, now);

      // send out all of the notifications to expo
      await notifyCron(ctx, { now, assertLockHeld });
    });
  } finally {
    await ctx.database.client.$disconnect();
  }
}

await notify();
