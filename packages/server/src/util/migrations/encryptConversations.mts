import { execute } from "./execute.mjs";
import { prepareEncryptConversations } from "./prepare.mjs";

const MIGRATION_NAME = "encrypt_conversations";

export async function encryptConversations(): Promise<void> {
  await execute(MIGRATION_NAME, prepareEncryptConversations);
}
