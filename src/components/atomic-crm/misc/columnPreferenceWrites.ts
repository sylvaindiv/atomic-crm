export const columnPreferenceWrites = new Map<string, Promise<unknown>>();

export async function waitForColumnPreferences() {
  await Promise.allSettled([...columnPreferenceWrites.values()]);
}
