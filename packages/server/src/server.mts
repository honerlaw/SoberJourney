import { clerkMiddleware } from "@clerk/express";
import express from "express";
import path from "path";
import { expressTRPCMiddleware } from "./network/rpc/index.mjs";
import { apiNotFound, config } from "./network/http/index.mjs";
import { getConfig } from "./util/config.mjs";
import cors from "cors";
import { register, logger } from "./util/logger/index.mjs";
import {
  parseApexHosts,
  redirectToWwwMiddleware,
} from "./util/middleware/redirect.mjs";
import * as dataMigrations from "./util/migrations/index.mjs";

const app = express();
const PORT = await getConfig("PORT", 3000);
const REDIRECT_APEX_HOSTS = await getConfig(
  "REDIRECT_APEX_HOSTS",
  "soberjourney.app",
);

// the app runs behind a single TLS terminating proxy hop
app.set("trust proxy", 1);

app.use(redirectToWwwMiddleware(parseApexHosts(REDIRECT_APEX_HOSTS)));

app.use(
  clerkMiddleware({
    // read directly so a config load failure can never re-enable debug
    debug: process.env.NODE_ENV !== "production",
    enableHandshake: true,
  }),
);

app.use(cors());

// note: the request context (and user upsert) is created once per request by
// the tRPC adapter, so it is intentionally not a global middleware

register({ app: app as unknown as express.Express, logger });

app.get("/api/health", express.json(), (req, res) =>
  res.status(200).send("OK"),
);

app.use("/api/trpc", express.json(), expressTRPCMiddleware);

app.use("/api/app/config", express.json(), config);

// unknown api paths should not fall through to the SPA's index.html
app.all("/api/{*splat}", apiNotFound);

// Serve static files from public directory (including .well-known)
app.use(express.static(path.join(process.cwd(), "public")));

// serve static files from static directory (the app itself)
app.use(express.static(path.join(process.cwd(), "static")));

// for unhandled paths, serve the index.html of the app
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(process.cwd(), "static/index.html"));
});

// run all data migrations on startup, this won't scale but its fine for now
// when there is almost no data
await Promise.all(
  Object.values(dataMigrations).map((migration) => migration()),
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
