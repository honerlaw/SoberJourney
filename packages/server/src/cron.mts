import { createContext } from "./context.mjs";
import {
  notify as notifyCron,
  receipts as receiptsCron,
} from "./cron/index.mjs";

async function notify() {
  const ctx = await createContext();

  // for previously run notifications, check the pending ones to get the final results
  await receiptsCron(ctx);

  // send out all of the notifications to expo
  await notifyCron(ctx);
}

await notify();
