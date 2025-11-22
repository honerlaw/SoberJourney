import { createClerkClient } from "@clerk/express";
import { getConfig } from "../../util/config.mjs";

const SECRET_KEY = await getConfig("CLERK_SECRET_KEY");

export const clerkClient = createClerkClient({
  secretKey: SECRET_KEY,
});
