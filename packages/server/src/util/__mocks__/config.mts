import { mock, type Mock, type TestContext } from "node:test";
import type { Config } from "../config.mjs";

type Callback<Key extends keyof Config = keyof Config> = (
  key: Key,
) => Promise<Config[Key]>;

let getConfig: Mock<Callback> | null = null;

export function mockConfig(ctx: TestContext, callback: Callback) {
  // the callback most likely will change on the next call,
  // so we need to reset the mock
  if (getConfig !== null) {
    getConfig.mock.restore();
    getConfig.mock.mockImplementation(async (key: keyof Config) => {
      return callback(key);
    });
    return;
  }

  getConfig = mock.fn(async (key: keyof Config) => {
    return callback(key);
  });

  ctx.mock.module("../config.mjs", {
    namedExports: {
      getConfig,
    },
  });
}
