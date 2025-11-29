import type { Request, Response, NextFunction } from "express";

/**
 * Middleware to redirect to www subdomain if no subdomain is specified
 */
export const redirectToWwwMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const host = req.get("host");

  if (!host) {
    return next();
  }

  // Split the host into parts (e.g., "example.com" or "www.example.com" or "subdomain.example.com")
  const parts = host.split(".");

  // If host has only 2 parts (e.g., "example.com" or "localhost:3000"), redirect to www
  if (parts.length !== 2) {
    return next();
  }

  const protocol = req.protocol;
  const newHost = `www.${host}`;
  const redirectUrl = `${protocol}://${newHost}${req.originalUrl}`;
  return res.redirect(301, redirectUrl);
};
