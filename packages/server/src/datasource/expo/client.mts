import { Expo } from "expo-server-sdk";

/**
 * Options for the Expo push client. EXPO_ACCESS_TOKEN (optional) authenticates
 * push sends, which Expo's "enhanced push security" setting then requires,
 * so a leaked push token alone can no longer be used to send to a device.
 * Unset keeps today's unauthenticated sends. Server-to-Expo only.
 */
export function buildExpoOptions(
  env: Record<string, string | undefined> = process.env,
): { accessToken?: string } {
  const accessToken = env.EXPO_ACCESS_TOKEN?.trim();
  return accessToken ? { accessToken } : {};
}

export const expoClient = new Expo(buildExpoOptions());
