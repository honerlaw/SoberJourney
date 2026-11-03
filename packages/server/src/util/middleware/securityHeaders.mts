import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Baseline security headers on every response (API and the web app).
 *
 * - Framing is refused (`frame-ancestors 'none'` plus X-Frame-Options for
 *   older browsers), so no other site can overlay the app to trick a click.
 *   Nothing embeds the app: Clerk sign-in runs in the app's own page, and
 *   Turnstile frames Cloudflare's origin, not ours.
 * - nosniff and a referrer policy that sends only the origin cross-site.
 * - HSTS only on HTTPS (req.secure, which reads X-Forwarded-Proto from the one
 *   trusted proxy hop), so local http development is unaffected.
 *
 * A full script/style CSP is deliberately not set yet: the Expo web build,
 * Clerk, Turnstile and Sentry need live verification first.
 */
export const SECURITY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

export const HSTS_VALUE = "max-age=31536000";

export function securityHeaders(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      res.setHeader(name, value);
    }
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", HSTS_VALUE);
    }
    next();
  };
}
