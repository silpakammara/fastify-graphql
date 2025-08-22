import { media } from '../models/media';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface MediaField {
  id: string | null;
  url: string | null;
  thumbnailUrl?: string | null;
  variants?: Record<string, string> | null;
}

/**
 * Transform a single media ID to a media object with URLs
 */
export function transformMediaField(mediaRecord: any): MediaField | null {
  if (!mediaRecord) return null;
  
  return {
    id: mediaRecord.id,
    url: mediaRecord.url,
    thumbnailUrl: mediaRecord.thumbnailUrl,
    variants: mediaRecord.variants || null,
  };
}

/**
 * Transform multiple media IDs to media objects with URLs
 */
export function transformMediaArray(mediaRecords: any[]): MediaField[] {
  return mediaRecords.filter(Boolean).map(transformMediaField).filter(Boolean) as MediaField[];
}

/**
 * Helper to include media fields in select queries
 * Usage: ...includeMediaFields('profilePic', 'banner')
 */
export function includeMediaFields(...fieldNames: string[]) {
  const fields: Record<string, any> = {};
  
  fieldNames.forEach(fieldName => {
    fields[`${fieldName}Media`] = media;
  });
  
  return fields;
}

/**
 * Transform a database row with joined media to include media URLs
 */
export function transformRowWithMedia<T extends Record<string, any>>(
  row: T,
  mediaFields: string[]
): T {
  const transformed = { ...row };
  
  mediaFields.forEach(fieldName => {
    const mediaKey = `${fieldName}Media`;
    if (row[mediaKey]) {
      transformed[fieldName] = transformMediaField(row[mediaKey]);
      delete transformed[mediaKey];
    } else if (row[fieldName]) {
      // If it's just an ID, set it to null (requires join to get URL)
      transformed[fieldName] = null;
    }
  });
  
  return transformed;
}

/**
 * Transform array fields containing media IDs
 */
export function transformArrayMediaField(
  mediaIds: string[] | null,
  mediaRecords: any[]
): MediaField[] {
  if (!mediaIds || mediaIds.length === 0) return [];
  
  const mediaMap = new Map(
    mediaRecords.map(m => [m.id, m])
  );
  
  return mediaIds
    .map(id => mediaMap.get(id))
    .filter(Boolean)
    .map(transformMediaField)
    .filter(Boolean) as MediaField[];
}