import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Context } from "../../context.mjs";
import { runWithLock } from "../run.mjs";
import { mockLogger } from "../../util/__mocks__/logger.mjs";

function harness(locked: boolean) {
  const { logger } = mockLogger();
  const queries: string[] = [];
  const tx = {
    $queryRaw: mock.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join("?");
      queries.push(sql);
      return sql.includes("pg_try_advisory_xact_lock")
        ? [{ locked }]
        : [{ "?column?": 1 }];
    }),
  };
  const $transaction = mock.fn(
    async (fn: (t: typeof tx) => Promise<unknown>, _options: unknown) => fn(tx),
  );
  const ctx = {
    logger,
    database: { client: { $transaction } },
  } as unknown as Context;
  return { ctx, tx, queries, $transaction };
}

describe("cron runWithLock", () => {
  it("skips the run when the advisory lock is held elsewhere", async () => {
    const { ctx } = harness(false);
    const work = mock.fn(async () => {});

    assert.equal(await runWithLock(ctx, work), "skipped");
    assert.equal(work.mock.callCount(), 0);
  });

  it("runs the work while holding the lock and checks liveness on the lock transaction", async () => {
    const { ctx, queries } = harness(true);
    const work = mock.fn(async (assertLockHeld: () => Promise<void>) => {
      await assertLockHeld();
    });

    assert.equal(await runWithLock(ctx, work), "ran");
    assert.equal(work.mock.callCount(), 1);
    assert.match(queries[0]!, /pg_try_advisory_xact_lock/);
    assert.match(queries[1]!, /SELECT 1/);
  });

  it("reports a failed run when the work throws", async () => {
    const { ctx } = harness(true);
    const work = mock.fn(async () => {
      throw new Error("boom");
    });
    assert.equal(await runWithLock(ctx, work), "failed");
  });
});
