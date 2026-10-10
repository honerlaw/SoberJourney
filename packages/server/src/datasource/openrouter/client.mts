import { getConfig } from "../../util/config.mjs";
import { logger } from "../../util/logger/index.mjs";
import { createClient } from "./createClient.mjs";

const API_KEY = await getConfig("OPENROUTER_API_KEY");

if (!API_KEY) {
  logger.warn(
    { tags: ["datasource", "openrouter", "client"] },
    "OPENROUTER_API_KEY is not set: Sponsor chat replies will fail until it is",
  );
}

export const openrouterClient = createClient(API_KEY);
