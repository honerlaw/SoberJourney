import type { Context } from "../context.mjs";

export async function receipts(ctx: Context): Promise<void> {
  // essentially, we now need to get all of the notifications that
  // are in the "PENDING" status with a receiptId
  // and then hit up expo to get the details back of those receipts
  // then handle errors, if no errosr we simply mark the notification as COMPLETE
  // we also should revoke a given token if the error indicates it is invalid
  // @todo re-use the logic from handleError if we can

  console.log(ctx);
}
