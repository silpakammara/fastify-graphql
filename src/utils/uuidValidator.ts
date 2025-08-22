/**
 * Validates if a string is a valid UUID v4 format
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Filters an array of IDs to only include valid UUIDs
 */
export function filterValidUUIDs(ids: string[]): string[] {
  return ids.filter(isValidUUID);
}