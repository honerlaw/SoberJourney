import { createContext } from "./context.mjs";
import {
  notify as notifyCron,
  receipts as receiptsCron,
  runWithLock,
} from "./cron/index.mjs";

async function notify() {
  const ctx = await createContext();

  try {
    const result = await runWithLock(ctx, async (assertLockHeld) => {
      const now = new Date();

      // for previously run notifications, check the pending ones to get the final results
      await receiptsCron(ctx, now);

      // send out all of the notifications to expo
      await notifyCron(ctx, { now, assertLockHeld });
    });

    // let the external scheduler see a failed run
    if (result === "failed") {
      process.exitCode = 1;
    }
  } finally {
    await ctx.database.client.$disconnect();
  }
}

await notify();
