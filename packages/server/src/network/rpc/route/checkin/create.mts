import {
  InternalServerError,
  UnauthorizedError,
} from "@onerlaw/framework/backend/rpc";
import { z } from "zod";
import { procedure } from "../../router.mjs";
import { CheckInMood } from "../../../../generated/prisma/enums.js";
import type { Context } from "../../../../context.mjs";

async function createJournalEntry(
  ctx: Context,
  userId: string,
  checkInId: string,
  journalContent: string | null | undefined,
) {
  if (!journalContent || journalContent.trim().length === 0) {
    return null;
  }

  // Encrypt the journal content before storing
  const encryptedContent = await ctx.service.encryption.encrypt(
    ctx,
    ctx.service.encryption.DEKIdentifier.JOURNAL,
    journalContent,
  );

  // Create journal entry associated with this check-in
  const journalEntry = await ctx.database.journal.create(
    userId,
    encryptedContent,
    checkInId,
  );

  if (!journalEntry) {
    throw new InternalServerError("Failed to create journal entry.");
  }

  return journalEntry;
}

const createCheckInInput = z.object({
  journeyId: z.string().min(1, "Journey ID is required."),
  mood: z.enum([
    CheckInMood.SAD,
    CheckInMood.TIRED,
    CheckInMood.NEUTRAL,
    CheckInMood.GOOD,
    CheckInMood.GREAT,
  ]),
  urgeStrength: z.number().min(1).max(10),
  journalEntry: z.string().optional().nullable(),
});

export const create = procedure
  .input(createCheckInInput)
  .mutation(async ({ ctx, input }) => {
    if (!ctx.auth.user) {
      throw new UnauthorizedError();
    }

    // Verify the journey belongs to the user
    const journey = await ctx.database.journey.get(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!journey) {
      throw new InternalServerError("Journey not found.");
    }

    // Get or create the journey check-in
    const checkIn = await ctx.database.checkin.getOrCreate(
      input.journeyId,
      ctx.auth.user.id,
    );

    if (!checkIn) {
      throw new InternalServerError("Failed to get or create check-in.");
    }

    // Create the check-in entry with mood and urge data
    const checkInEntry = await ctx.database.checkin.createEntry(
      checkIn.id,
      input.mood,
      input.urgeStrength,
    );

    if (!checkInEntry) {
      throw new InternalServerError("Failed to create check-in entry.");
    }

    // Create journal entry if content is provided
    const journalEntryResult = await createJournalEntry(
      ctx,
      ctx.auth.user.id,
      checkIn.id,
      input.journalEntry,
    );

    return {
      success: true,
      checkIn: {
        id: checkIn.id,
        journeyId: checkIn.journeyId,
        createdAt: checkIn.createdAt,
        updatedAt: checkIn.updatedAt,
      },
      checkInEntry: checkInEntry
        ? {
            id: checkInEntry.id,
            mood: input.mood,
            urgeStrength: input.urgeStrength,
            createdAt: checkInEntry.createdAt,
            updatedAt: checkInEntry.updatedAt,
          }
        : null,
      journalEntry: journalEntryResult
        ? {
            id: journalEntryResult.id,
            content: input.journalEntry, // Return the original unencrypted content
            createdAt: journalEntryResult.createdAt,
            updatedAt: journalEntryResult.updatedAt,
          }
        : null,
    };
  });
