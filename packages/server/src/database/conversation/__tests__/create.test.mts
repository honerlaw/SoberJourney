import { afterEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mockLogger } from "../../../util/__mocks__/logger.mjs";
import { mockDatabase } from "../../../util/__mocks__/database.mjs";

describe("Database Conversation Create", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  async function harness() {
    // Mock the create function module to get fresh imports
    const { create } = await import("../create.mjs");

    const mockConversation = {
      id: "conv-123",
      userId: "user-123",
      openaiConversationId: "openai-456",
      createdAt: new Date(),
      updatedAt: new Date(),
      title: null,
    };

    const logger = mockLogger();

    return {
      create,
      logger,
      mocks: {
        mockConversation,
      },
    };
  }

  it("should successfully create a conversation", async () => {
    const {
      create,
      logger,
      mocks: { mockConversation },
    } = await harness();

    const userId = "user-123";
    const openaiConversationId = "openai-456";

    const database = mockDatabase({
      conversation: {
        create: mock.fn(() => {
          return Promise.resolve(mockConversation);
        }),
      },
    });

    const result = await create(
      logger.logger,
      database.client,
      userId,
      openaiConversationId,
    );

    // Verify the result
    assert.ok(result);
    assert.strictEqual(result.userId, userId);
    assert.strictEqual(result.openaiConversationId, openaiConversationId);

    // Verify database client was called with correct parameters
    assert.strictEqual(
      database.mocked.conversation?.create?.mock.calls.length,
      1,
    );
    assert.deepStrictEqual(
      database.mocked.conversation?.create?.mock.calls[0]?.arguments[0],
      {
        data: {
          userId,
          openaiConversationId,
        },
      },
    );

    // Verify logger was not called (no errors)
    assert.strictEqual(logger.mocked.error.mock.calls.length, 0);
  });

  it("should handle database errors and return null", async () => {
    const { create, logger } = await harness();

    const userId = "user-123";
    const openaiConversationId = "openai-456";
    const testError = new Error("Database connection failed");

    const database = mockDatabase({
      conversation: {
        create: mock.fn(() => {
          throw testError;
        }),
      },
    });

    const result = await create(
      logger.logger,
      database.client,
      userId,
      openaiConversationId,
    );

    // Verify the result is null
    assert.strictEqual(result, null);

    // Verify database client was called
    assert.strictEqual(
      database.mocked.conversation?.create?.mock.calls.length,
      1,
    );

    // Verify logger was called with correct error information
    assert.strictEqual(logger.mocked.error.mock.calls.length, 1);
    assert.deepStrictEqual(logger.mocked.error.mock.calls[0]?.arguments[0], {
      error: testError,
      tags: ["database", "conversation", "create"],
    });
    assert.strictEqual(
      logger.mocked.error.mock.calls[0]?.arguments[1],
      "Error creating conversation",
    );
  });

  it("should handle async database errors and return null", async () => {
    const { create, logger } = await harness();

    const userId = "user-456";
    const openaiConversationId = "openai-789";
    const testError = new Error("Async database error");

    // Mock the create method to reject with an error
    const database = mockDatabase({
      conversation: {
        create: mock.fn(() => {
          return Promise.reject(testError);
        }),
      },
    });

    const result = await create(
      logger.logger,
      database.client,
      userId,
      openaiConversationId,
    );

    // Verify the result is null
    assert.strictEqual(result, null);

    // Verify database client was called with correct parameters
    assert.strictEqual(
      database.mocked.conversation?.create?.mock.calls.length,
      1,
    );
    assert.deepStrictEqual(
      database.mocked.conversation?.create?.mock.calls[0]?.arguments[0],
      {
        data: {
          userId,
          openaiConversationId,
        },
      },
    );

    // Verify logger was called with correct error information
    assert.strictEqual(logger.mocked.error.mock.calls.length, 1);
    assert.deepStrictEqual(logger.mocked.error.mock.calls[0]?.arguments[0], {
      error: testError,
      tags: ["database", "conversation", "create"],
    });
    assert.strictEqual(
      logger.mocked.error.mock.calls[0]?.arguments[1],
      "Error creating conversation",
    );
  });

  it("should pass through all parameters correctly", async () => {
    const {
      create,
      logger,
      mocks: { mockConversation },
    } = await harness();

    const userId = "different-user-789";
    const openaiConversationId = "different-openai-abc";

    const database = mockDatabase({
      conversation: {
        create: mock.fn(() => {
          return Promise.resolve(mockConversation);
        }),
      },
    });

    await create(logger.logger, database.client, userId, openaiConversationId);

    // Verify all parameters were passed correctly
    assert.strictEqual(
      database.mocked.conversation?.create?.mock.calls.length,
      1,
    );
    assert.deepStrictEqual(
      database.mocked.conversation?.create?.mock.calls[0]?.arguments[0],
      {
        data: {
          userId,
          openaiConversationId,
        },
      },
    );
  });
});
