import { z } from "zod";

/**
 * Optional pagination fields. Values are clamped rather than rejected, so a
 * client can never fail validation because of them.
 */
export function paginationFields(maxLimit: number) {
  return {
    cursor: z.string().optional(),
    limit: z
      .number()
      .optional()
      .transform((value) =>
        value === undefined || Number.isNaN(value)
          ? undefined
          : Math.min(maxLimit, Math.max(1, Math.trunc(value))),
      ),
  };
}

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Pagination is only applied when the caller asks for it. Released apps send
 * neither field and get today's unpaginated result.
 */
export function wantsPagination(
  input:
    | { cursor?: string | undefined; limit?: number | undefined }
    | undefined,
): boolean {
  return input?.cursor !== undefined || input?.limit !== undefined;
}
