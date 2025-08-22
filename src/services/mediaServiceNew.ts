import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { media, type Media, type NewMedia, type MediaResourceType, type MediaTag } from '../models/media';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { transformToSimpleMedia, type SimpleMediaField } from '../utils/mediaHelpers';

export class MediaServiceNew {
  constructor(private db: NodePgDatabase<any>) {}

  // Create a new media record
  async create(data: NewMedia): Promise<Media> {
    const [newMedia] = await this.db
      .insert(media)
      .values(data)
      .returning();
    
    return newMedia!;
  }

  // Get media by resource
  async getByResource(resourceType: MediaResourceType, resourceId: string, tag?: MediaTag): Promise<Media[]> {
    const conditions = [
      eq(media.resourceType, resourceType),
      eq(media.resourceId, resourceId)
    ];

    if (tag) {
      conditions.push(eq(media.tag, tag));
    }

    const result = await this.db
      .select()
      .from(media)
      .where(and(...conditions))
      .orderBy(media.position, media.uploadedAt);

    return result;
  }

  // Get simple media format by resource
  async getSimpleByResource(resourceType: MediaResourceType, resourceId: string, tag?: MediaTag): Promise<SimpleMediaField[]> {
    const mediaRecords = await this.getByResource(resourceType, resourceId, tag);
    return mediaRecords.map(m => transformToSimpleMedia(m)).filter((m): m is SimpleMediaField => m !== null);
  }

  // Get single media by resource and tag
  async getOneByResource(resourceType: MediaResourceType, resourceId: string, tag: MediaTag): Promise<Media | null> {
    const [result] = await this.db
      .select()
      .from(media)
      .where(
        and(
          eq(media.resourceType, resourceType),
          eq(media.resourceId, resourceId),
          eq(media.tag, tag)
        )
      )
      .limit(1);

    return result || null;
  }

  // Get simple single media by resource and tag
  async getSimpleOneByResource(resourceType: MediaResourceType, resourceId: string, tag: MediaTag): Promise<SimpleMediaField | null> {
    const mediaRecord = await this.getOneByResource(resourceType, resourceId, tag);
    return mediaRecord ? transformToSimpleMedia(mediaRecord) : null;
  }

  // Batch get media for multiple resources
  async getBatchByResources(
    resourceType: MediaResourceType, 
    resourceIds: string[], 
    tag?: MediaTag
  ): Promise<Map<string, Media[]>> {
    if (resourceIds.length === 0) return new Map();

    const conditions = [
      eq(media.resourceType, resourceType),
      inArray(media.resourceId, resourceIds)
    ];

    if (tag) {
      conditions.push(eq(media.tag, tag));
    }

    const records = await this.db
      .select()
      .from(media)
      .where(and(...conditions))
      .orderBy(media.position, media.uploadedAt);

    // Group by resourceId
    const grouped = new Map<string, Media[]>();
    records.forEach(record => {
      const existing = grouped.get(record.resourceId) || [];
      existing.push(record);
      grouped.set(record.resourceId, existing);
    });

    return grouped;
  }

  // Batch get simple media for multiple resources
  async getSimpleBatchByResources(
    resourceType: MediaResourceType,
    resourceIds: string[],
    tag?: MediaTag
  ): Promise<Map<string, SimpleMediaField[]>> {
    const batchMedia = await this.getBatchByResources(resourceType, resourceIds, tag);
    const result = new Map<string, SimpleMediaField[]>();

    batchMedia.forEach((mediaList, resourceId) => {
      const simpleMedia = mediaList
        .map(m => transformToSimpleMedia(m))
        .filter((m): m is SimpleMediaField => m !== null);
      result.set(resourceId, simpleMedia);
    });

    return result;
  }
  async findById(mediaId: string): Promise<Media | null> {
    const [result] = await this.db
      .select()
      .from(media)
      .where(eq(media.id, mediaId))
      .limit(1);

    return result || null;
  }

  // Update media position
  async updatePosition(mediaId: string, position: number): Promise<boolean> {
    const [updated] = await this.db
      .update(media)
      .set({ position })
      .where(eq(media.id, mediaId))
      .returning();

    return !!updated;
  }

  // Delete media by ID
  async delete(mediaId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(media)
      .where(eq(media.id, mediaId))
      .returning();

    return !!deleted;
  }

  // Delete all media for a resource
  async deleteByResource(resourceType: MediaResourceType, resourceId: string, tag?: MediaTag): Promise<number> {
    const conditions = [
      eq(media.resourceType, resourceType),
      eq(media.resourceId, resourceId)
    ];

    if (tag) {
      conditions.push(eq(media.tag, tag));
    }

    const deleted = await this.db
      .delete(media)
      .where(and(...conditions))
      .returning();

    return deleted.length;
  }

  // Helper to get media URLs as array (useful for migrations)
  async getMediaIdsAsArray(resourceType: MediaResourceType, resourceId: string, tag?: MediaTag): Promise<string[]> {
    const mediaRecords = await this.getByResource(resourceType, resourceId, tag);
    return mediaRecords.map(m => m.id);
  }
}