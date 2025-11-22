/* eslint-disable @typescript-eslint/no-explicit-any */

import { type Mock } from "node:test";
import type { Context } from "../context.mjs";

// loosen types a bit to make things easier to mock around the database client
type MockedFunction<T extends (...args: any[]) => any> = Mock<
  (...args: any[]) => Promise<Awaited<ReturnType<T>>>
>;

// Recursive type for deep mocking of Context
type DeepMocked<T> = T extends (...args: any[]) => any
  ? MockedFunction<T>
  : T extends object
    ? {
        [K in keyof T]?: DeepMocked<T[K]>;
      }
    : T;

// Use DeepMocked for MockedContext
type MockedContext = DeepMocked<Context>;

/*type MockedContext = {
  [K in keyof Context]?: Context[K] extends object
    ? {
        [P in keyof Context[K]]?: Context[K][P] extends (
          ...args: any[]
        ) => any
          ? MockedFunction<Context[K][P]>
          : unknown;
      }
    : Context[K] extends (...args: any[]) => any
      ? MockedFunction<Context[K]>
      : Context[K];
};*/

// allow for better type safety in tests
export function mockContext(mocked: MockedContext = {}) {
  return {
    context: mocked as unknown as Context,
    mocked: mocked as unknown as MockedContext,
  };
}
