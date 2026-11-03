import { TRPCError, type TRPCDefaultErrorShape } from "@trpc/server";

/**
 * Message sent in place of an unexpected error's own message.
 */
export const GENERIC_INTERNAL_MESSAGE =
  "Something went wrong. Please try again.";

/**
 * True for an INTERNAL_SERVER_ERROR that tRPC built by wrapping something a
 * procedure threw that was not a TRPCError (a plain `Error` from a library,
 * Prisma, the config loader …). Its message is the wrapped error's own,
 * which can describe internals, so it is not sent to clients.
 *
 * Deliberate errors keep their message: an `InternalServerError("…")` has no
 * cause, and a TRPCError built with an explicit message and a cause has a
 * message that differs from the cause's.
 */
export function isWrappedUnexpectedError(error: TRPCError): boolean {
  const cause = error.cause;
  return (
    error.code === "INTERNAL_SERVER_ERROR" &&
    cause !== undefined &&
    !(cause instanceof TRPCError) &&
    error.message === cause.message
  );
}

/**
 * tRPC errorFormatter. Only replaces the message of a wrapped unexpected
 * error; every other error, including UNAUTHORIZED (which released apps act
 * on), passes through untouched.
 */
export function formatError<Shape extends TRPCDefaultErrorShape>({
  shape,
  error,
}: {
  shape: Shape;
  error: TRPCError;
}): Shape {
  if (!isWrappedUnexpectedError(error)) {
    return shape;
  }
  return { ...shape, message: GENERIC_INTERNAL_MESSAGE };
}
