import { eq, and, inArray, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { media } from '../models/media';

export interface MediaRequest {
  resourceIds: string[];
  resourceType: 'post' | 'user_profile' | 'business' | 'news';
  tags?: string[] | undefined;
}

export interface MediaRecord {
  id: string;
  cloudflareId?: string;
  url: string;
  thumbnailUrl?: string | null;
  variants?: any;
  resourceId: string;
  resourceType: string;
  tag: string;
  position?: number;
}

export interface ProcessedMedia {
  id: string;
  url: string;
  thumbnailUrl?: string;
  resourceId: string;
  tag: string;
  position?: number;
}

export interface MediaMaps {
  byResource: Map<string, ProcessedMedia[]>;
  featuredImages: Map<string, ProcessedMedia>;
  galleries: Map<string, ProcessedMedia[]>;
  profilePics: Map<string, ProcessedMedia>;
  businessLogos: Map<string, ProcessedMedia>;
  singleMedia: Map<string, ProcessedMedia>;
}

export interface ResourceDescriptor {
  resourceType: MediaRequest['resourceType'];
  ids: string[];
  tags?: string[];
}

export class UniversalMediaHelper {
  constructor(private db: NodePgDatabase<any>) {}

  private getBestImageUrl(mediaRecord: MediaRecord): string {
    if (mediaRecord?.variants && typeof mediaRecord.variants === 'object') {
      return mediaRecord.variants.public || mediaRecord.url;
    }
    return mediaRecord?.url || '';
  }

  private processMediaRecord(record: MediaRecord): ProcessedMedia {
    return {
      id: record.id,
      url: this.getBestImageUrl(record),
      thumbnailUrl: record.thumbnailUrl || '',
      resourceId: record.resourceId,
      tag: record.tag,
      position: record.position || 0,
    };
  }

  async fetchMediaBatch(requests: MediaRequest[]): Promise<MediaRecord[]> {
    if (!requests || requests.length === 0) return [];

    const conditions = [];

    for (const request of requests) {
      if (request.resourceIds.length === 0) continue;

      let condition = and(
        inArray(media.resourceId, request.resourceIds),
        eq(media.resourceType, request.resourceType)
      );

      if (request.tags && request.tags.length > 0) {
        const tagConditions = request.tags.map(tag => eq(media.tag, tag));
        const tagCondition = tagConditions.length === 1
          ? tagConditions[0]
          : or(...tagConditions);
        condition = and(condition, tagCondition);
      }

      conditions.push(condition);
    }

    if (conditions.length === 0) return [];

    return this.db.query.media.findMany({
      where: or(...conditions),
      columns: {
        id: true,
        cloudflareId: true,
        url: true,
        thumbnailUrl: true,
        variants: true,
        resourceId: true,
        resourceType: true,
        tag: true,
        position: true,
      },
      orderBy: [media.position],
    });
  }

  async getMediaMapsForResources(descriptors: ResourceDescriptor[]): Promise<MediaMaps> {
    const requests: MediaRequest[] = descriptors
      .filter(d => d.ids.length > 0)
      .map(d => ({
        resourceIds: d.ids,
        resourceType: d.resourceType,
        tags: d.tags,
      }));

    const mediaRecords = await this.fetchMediaBatch(requests);
    return this.createMediaMaps(mediaRecords);
  }

  private createMediaMaps(mediaRecords: MediaRecord[]): MediaMaps {
    const byResource = new Map<string, ProcessedMedia[]>();
    const featuredImages = new Map<string, ProcessedMedia>();
    const galleries = new Map<string, ProcessedMedia[]>();
    const profilePics = new Map<string, ProcessedMedia>();
    const businessLogos = new Map<string, ProcessedMedia>();
    const singleMedia = new Map<string, ProcessedMedia>();

    for (const record of mediaRecords) {
      const processed = this.processMediaRecord(record);

      if (!byResource.has(record.resourceId)) {
        byResource.set(record.resourceId, []);
      }
      byResource.get(record.resourceId)!.push(processed);

      switch (record.tag) {
        case 'featured_image':
          featuredImages.set(record.resourceId, processed);
          break;

        case 'gallery':
          if (!galleries.has(record.resourceId)) {
            galleries.set(record.resourceId, []);
          }
          galleries.get(record.resourceId)!.push(processed);
          break;

        case 'profile_pic':
          if (record.resourceType === 'user_profile') {
            profilePics.set(record.resourceId, processed);
          }
          break;

        case 'logo':
          if (record.resourceType === 'business') {
            businessLogos.set(record.resourceId, processed);
          }
          break;

        default:
          singleMedia.set(record.resourceId, processed);
          break;
      }
    }

    galleries.forEach(images => {
      images.sort((a, b) => (a.position || 0) - (b.position || 0));
    });

    return {
      byResource,
      featuredImages,
      galleries,
      profilePics,
      businessLogos,
      singleMedia,
    };
  }

  async getMediaByIds(mediaIds: string[]): Promise<ProcessedMedia[]> {
    if (!mediaIds || mediaIds.length === 0) return [];

    const mediaRecords = await this.db
      .select({
        id: media.id,
        cloudflareId: media.cloudflareId,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        variants: media.variants,
        resourceId: media.resourceId,
        resourceType: media.resourceType,
        tag: media.tag,
        position: media.position,
      })
      .from(media)
      .where(inArray(media.id, mediaIds));

    return mediaRecords.map(record => this.processMediaRecord(record));
  }

  transformToSimpleMedia(mediaRecord: any): { id: string; url: string } | null {
    if (!mediaRecord) return null;
    return {
      id: mediaRecord.id,
      url: this.getBestImageUrl(mediaRecord),
    };
  }
}
