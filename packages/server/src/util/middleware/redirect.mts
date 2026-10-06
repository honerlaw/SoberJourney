import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Parse a comma-separated list of apex hosts (e.g. "soberjourney.app").
 */
export function parseApexHosts(value: string): string[] {
  return value
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0);
}

/**
 * Middleware to redirect an allowlisted apex host to its www subdomain.
 *
 * Only hosts in the allowlist are redirected, so a spoofed Host header can
 * never produce a redirect to an arbitrary domain. The target is always
 * https (the app is served behind a TLS terminating proxy), and 308 keeps
 * the method and body intact for non-GET requests.
 */
export function redirectToWwwMiddleware(apexHosts: string[]): RequestHandler {
  const allowlist = new Set(apexHosts.map((host) => host.toLowerCase()));

  return (req: Request, res: Response, next: NextFunction) => {
    const host = req.get("host");

    if (!host) {
      return next();
    }

    // strip the port (if any) before matching
    const hostname = host.split(":")[0]?.toLowerCase();

    if (!hostname || !allowlist.has(hostname)) {
      return next();
    }

    return res.redirect(308, `https://www.${hostname}${req.originalUrl}`);
  };
}
