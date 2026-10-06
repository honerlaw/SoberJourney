import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { apiNotFound } from "../notFound.mjs";

describe("apiNotFound", () => {
  it("responds with a 404 json body", () => {
    const json = mock.fn();
    const status = mock.fn(() => ({ json }));
    apiNotFound({} as Request, { status } as unknown as Response);
    assert.deepEqual(status.mock.calls[0]?.arguments, [404]);
    assert.deepEqual(json.mock.calls[0]?.arguments, [{ error: "Not found" }]);
  });
});
