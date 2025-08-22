import { CloudflareImagesService } from './cloudflareService';
import { MediaService } from './mediaService';
import type { FastifyInstance } from 'fastify';

export class MediaCleanupService {
  private cloudflare: CloudflareImagesService;
  private mediaService: MediaService;

  constructor(
    private db: any,
    private fastify: FastifyInstance
  ) {
    this.cloudflare = new CloudflareImagesService(fastify);
    this.mediaService = new MediaService(db, fastify);
  }

  /**
   * List all images from Cloudflare with specific metadata filters
   */
  async listImagesByMetadata(filters: {
    app?: string;
    environment?: string;
    userId?: string;
    uploadedBefore?: Date;
    uploadedAfter?: Date;
  }): Promise<any[]> {
    const allImages: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.cloudflare.listImages(page, 100);
      
      if (response.result && response.result.images) {
        const filtered = response.result.images.filter((img: any) => {
          const meta = img.meta || {};
          
          // Apply filters
          if (filters.app && meta.app !== filters.app) return false;
          if (filters.environment && meta.environment !== filters.environment) return false;
          if (filters.userId && meta.userId !== filters.userId) return false;
          
          if (filters.uploadedBefore || filters.uploadedAfter) {
            const uploadedAt = meta.uploadedAt ? new Date(meta.uploadedAt) : null;
            if (uploadedAt) {
              if (filters.uploadedBefore && uploadedAt > filters.uploadedBefore) return false;
              if (filters.uploadedAfter && uploadedAt < filters.uploadedAfter) return false;
            }
          }
          
          return true;
        });
        
        allImages.push(...filtered);
      }
      
      hasMore = response.result?.images?.length === 100;
      page++;
    }

    return allImages;
  }

  /**
   * Clean up orphaned images (in Cloudflare but not in database)
   */
  async cleanupOrphanedImages(dryRun = true): Promise<{
    found: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      found: 0,
      deleted: 0,
      errors: [] as string[],
    };

    try {
      // Get all Sarvail images from Cloudflare
      const cloudflareImages = await this.listImagesByMetadata({
        app: 'sarvail',
        environment: this.fastify.config.NODE_ENV,
      });

      result.found = cloudflareImages.length;
      this.fastify.log.info(`Found ${result.found} Sarvail images in Cloudflare`);

      // Check each image against database
      for (const cfImage of cloudflareImages) {
        try {
          const dbMedia = await this.mediaService.getByCloudflareId(cfImage.id);
          
          if (!dbMedia) {
            this.fastify.log.info(`Orphaned image found: ${cfImage.id} (${cfImage.filename})`);
            
            if (!dryRun) {
              await this.cloudflare.deleteImage(cfImage.id);
              result.deleted++;
              this.fastify.log.info(`Deleted orphaned image: ${cfImage.id}`);
            }
          }
        } catch (error) {
          const errorMsg = `Error processing image ${cfImage.id}: ${error}`;
          this.fastify.log.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error}`);
    }
  }

  /**
   * Clean up old images based on age
   */
  async cleanupOldImages(
    olderThanDays: number,
    dryRun = true
  ): Promise<{
    found: number;
    deleted: number;
    errors: string[];
  }> {
    const result = {
      found: 0,
      deleted: 0,
      errors: [] as string[],
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      // Get old images from Cloudflare
      const oldImages = await this.listImagesByMetadata({
        app: 'sarvail',
        environment: this.fastify.config.NODE_ENV,
        uploadedBefore: cutoffDate,
      });

      result.found = oldImages.length;
      this.fastify.log.info(`Found ${result.found} images older than ${olderThanDays} days`);

      if (!dryRun) {
        for (const image of oldImages) {
          try {
            // Delete from database first (if exists)
            const dbMedia = await this.mediaService.getByCloudflareId(image.id);
            if (dbMedia && image.meta?.userId) {
              await this.mediaService.deleteMedia(dbMedia.id, image.meta.userId);
            } else {
              // Just delete from Cloudflare if not in DB
              await this.cloudflare.deleteImage(image.id);
            }
            
            result.deleted++;
            this.fastify.log.info(`Deleted old image: ${image.id}`);
          } catch (error) {
            const errorMsg = `Error deleting image ${image.id}: ${error}`;
            this.fastify.log.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Cleanup failed: ${error}`);
    }
  }

  /**
   * Get usage statistics by metadata
   */
  async getUsageStats(): Promise<{
    total: number;
    byEnvironment: Record<string, number>;
    byUser: Record<string, number>;
    byMonth: Record<string, number>;
  }> {
    const stats = {
      total: 0,
      byEnvironment: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byMonth: {} as Record<string, number>,
    };

    const allImages = await this.listImagesByMetadata({
      app: 'sarvail',
    });

    stats.total = allImages.length;

    for (const image of allImages) {
      const meta = image.meta || {};
      
      // By environment
      if (meta.environment) {
        stats.byEnvironment[meta.environment] = (stats.byEnvironment[meta.environment] || 0) + 1;
      }
      
      // By user
      if (meta.userId) {
        stats.byUser[meta.userId] = (stats.byUser[meta.userId] || 0) + 1;
      }
      
      // By month
      if (meta.uploadedAt) {
        const date = new Date(meta.uploadedAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        stats.byMonth[monthKey] = (stats.byMonth[monthKey] || 0) + 1;
      }
    }

    return stats;
  }
}