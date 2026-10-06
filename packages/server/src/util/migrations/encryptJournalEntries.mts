import { execute } from "./execute.mjs";
import { prepareEncryptJournalEntries } from "./prepare.mjs";

const MIGRATION_NAME = "encrypt_journal_entries";

export async function encryptJournalEntries(): Promise<void> {
  await execute(MIGRATION_NAME, prepareEncryptJournalEntries);
}
