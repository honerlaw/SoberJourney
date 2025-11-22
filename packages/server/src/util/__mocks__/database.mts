/* eslint-disable @typescript-eslint/no-explicit-any */

import { type Mock } from "node:test";
import type { DBClient } from "../database.mjs";

// loosen types a bit to make things easier to mock around the database client
type MockedFunction<T extends (...args: any[]) => any> = Mock<
  (...args: any[]) => Promise<Awaited<ReturnType<T>>>
>;

type MockedDBClient = {
  [K in keyof DBClient]?: DBClient[K] extends object
    ? {
        [P in keyof DBClient[K]]?: DBClient[K][P] extends (
          ...args: any[]
        ) => any
          ? MockedFunction<DBClient[K][P]>
          : unknown;
      }
    : DBClient[K] extends (...args: any[]) => any
      ? MockedFunction<DBClient[K]>
      : unknown;
};

// allow for better type safety in tests
export function mockDatabase(mocked: MockedDBClient = {}) {
  return {
    client: mocked as unknown as DBClient,
    mocked,
  };
}
