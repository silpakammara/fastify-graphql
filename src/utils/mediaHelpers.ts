import { media } from '../models/media';
import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface SimpleMediaField {
  id: string;
  url: string;
}

/**
 * Transform media record to simple format with /public variant
 */
export function transformToSimpleMedia(mediaRecord: any): SimpleMediaField | null {
  if (!mediaRecord?.id || !mediaRecord?.url) return null;
  
  // Ensure URL uses /public variant
  const baseUrl = mediaRecord.url.replace(/\/\w+$/, '');
  
  return {
    id: mediaRecord.id,
    url: `${baseUrl}/public`
  };
}

/**
 * Get media by ID with /public variant
 */
export async function getMediaById(
  db: NodePgDatabase<any>,
  mediaId: string | null
): Promise<SimpleMediaField | null> {
  if (!mediaId) return null;
  
  const [mediaRecord] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);
  
  return transformToSimpleMedia(mediaRecord);
}

/**
 * Get multiple media by IDs with /public variant
 */
export async function getMediaByIds(
  db: NodePgDatabase<any>,
  mediaIds: string[]
): Promise<SimpleMediaField[]> {
  if (!mediaIds || mediaIds.length === 0) return [];
  
  const mediaRecords = await db
    .select()
    .from(media)
    .where(inArray(media.id, mediaIds));
  
  // Create a map to maintain order
  const mediaMap = new Map<string, any>();
  mediaRecords.forEach(m => mediaMap.set(m.id, m));
  
  // Return in original order
  return mediaIds
    .map(id => mediaMap.get(id))
    .filter(Boolean)
    .map(transformToSimpleMedia)
    .filter(Boolean) as SimpleMediaField[];
}