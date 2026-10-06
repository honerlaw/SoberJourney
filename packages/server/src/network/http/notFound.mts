import type { Request, Response } from "express";

/**
 * Unknown /api/* paths return a JSON 404 instead of the SPA's index.html.
 */
export const apiNotFound = (req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
};
