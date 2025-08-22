import { CloudflareImagesService } from '../services/cloudflareService';
import { MediaServiceNew } from '../services/mediaServiceNew';
import type { FastifyInstance } from 'fastify';
import type { Media, MediaResourceType, MediaTag } from '../models/media';

// Types for upload configuration
export interface UploadFile {
  buffer: Buffer;
  filename?: string;
  mimetype: string;
}

export interface UploadContext {
  resourceType: MediaResourceType;
  resourceId: string;
  tag: MediaTag;
  authUserId: string;
  actualUserId?: string;
  businessId?: string;
  position?: number;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  validateImageType?: boolean;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  generateThumbnail?: boolean;
  replaceExisting?: boolean; // For single media like profile pics
  useGlobalPositioning?: boolean
}

export interface UploadResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  cloudflareId: string;
  filename: string;
  size: number;
  position: number;
}

export class UniversalImageUploadHelper {
  private cloudflareService: CloudflareImagesService;
  public mediaService: MediaServiceNew; 
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.cloudflareService = new CloudflareImagesService(fastify);
    this.mediaService = new MediaServiceNew(fastify.db);
  }

   // Upload a single image file
  async uploadSingle(
    file: UploadFile,
    context: UploadContext,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Validate options
    this.validateUploadOptions(file, options);

    // Handle replacement for single media types (profile pics, banners)
    if (options.replaceExisting) {
      await this.replaceExistingMedia(context);
    }

    // Determine position
    const position = await this.determinePosition(context, options?.replaceExisting||false,options.useGlobalPositioning);

    // Upload to Cloudflare and create media record
    const result = await this.processUpload(file, context, position);
    
    return result;
  }
   // Upload multiple image files (for posts, galleries, etc.)
  async uploadMultiple(
    files: UploadFile[],
    context: UploadContext,
    options: UploadOptions = {}
  ): Promise<{
    successful: UploadResult[];
    failed: Array<{ filename?: string; error: string }>;
  }> {
    const successful: UploadResult[] = [];
    const failed: Array<{ filename?: string; error: string }> = [];

    // Get starting position for multiple uploads
    let currentPosition = await this.determinePosition(context, false, options.useGlobalPositioning);

    for (const file of files) {
      try {
        // Validate each file
        this.validateUploadOptions(file, options);

        // Create context for this specific file
        const fileContext = {
          ...context,
          position: currentPosition
        };

        const result = await this.processUpload(file, fileContext, currentPosition);
        successful.push(result);
        currentPosition++;
        
      } catch (error) {
        failed.push({
          filename: file.filename ||"",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        this.fastify.log.error(`Upload failed for file ${file.filename}:`, error);
      }
    }

    return { successful, failed };
  }

  /**
   * Upload from multipart form data (Fastify integration)
   */
  async uploadFromMultipart(
    request: any, // Fastify request
    context: UploadContext,
    options: UploadOptions = {}
  ): Promise<{
    successful: UploadResult[];
    failed: Array<{ filename?: string; error: string }>;
  }> {
    const files: UploadFile[] = [];
    const parts = request.parts();

    console.log('partslfsdfd', parts)

    // Collect all files from multipart
    for await (const part of parts) {
      if (part.type === 'file') {
        try {
          const buffer = await part.toBuffer();
          if (buffer.length > 0) {
            files.push({
              buffer,
              filename: part.filename,
              mimetype: part.mimetype
            });
          }
        } catch (error) {
          this.fastify.log.error(`Error processing multipart file ${part.filename}:`, error);
        }
      }
    }

    if (files.length === 0) {
      throw new Error('No valid files found in request');
    }

    // For single file uploads (profile pics, banners)
    if (options.replaceExisting && files.length === 1) {
      if (!files[0]) {
        throw new Error('No valid file found for single upload');
      }
      const result = await this.uploadSingle(files[0], context, options);
      return {
        successful: [result],
        failed: []
      };
    }

    // For multiple file uploads
    return await this.uploadMultiple(files, context, options);
  }

  // media types declaration 
  static getPresetConfig(type: 'profile_pic' | 'banner' | 'post_image' | 'business_logo' | 'business_banner'): {
    context: Partial<UploadContext>;
    options: UploadOptions;
  } {
    switch (type) {
      case 'profile_pic':
        return {
          context: {
            resourceType: 'user_profile',
            tag: 'profile_pic'
          },
          options: {
            maxFileSize: 5 * 1024 * 1024, 
            replaceExisting: true,
            generateThumbnail: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
          }
        };

      case 'banner':
        return {
          context: {
            resourceType: 'user_profile',
            tag: 'banner'
          },
          options: {
            maxFileSize: 8 * 1024 * 1024, 
            replaceExisting: true,
            generateThumbnail: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
          }
        };

      case 'post_image':
        return {
          context: {
            resourceType: 'post',
            tag: 'gallery'
          },
          options: {
            maxFileSize: 10 * 1024 * 1024, 
            replaceExisting: false,
            generateThumbnail: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            useGlobalPositioning: true
          }
        };

      case 'business_logo':
        return {
          context: {
            resourceType: 'business',
            tag: 'logo'
          },
          options: {
            maxFileSize: 3 * 1024 * 1024,
            generateThumbnail: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
          }
        };

      case 'business_banner':
        return {
          context: {
            resourceType: 'business',
            tag: 'banner'
          },
          options: {
            maxFileSize: 10 * 1024 * 1024, 
            replaceExisting: true,
            generateThumbnail: true,
            allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
          }
        };

      default:
        return {
          context: {},
          options: {
            maxFileSize: 10 * 1024 * 1024,
            replaceExisting: false,
            generateThumbnail: true
          }
        };
    }
  }

    //Get existing media for a resource'
  async getExistingMedia(
    resourceType: MediaResourceType,
    resourceId: string,
    tag?: MediaTag
  ): Promise<Media[]> {
    return await this.mediaService.getByResource(resourceType, resourceId, tag);
  }
   // Delete media by ID
  async deleteMedia(mediaId: string): Promise<boolean> {

  const record = await this.mediaService.findById(mediaId);
  if (!record) return false;
  // Delete from Cloudflare
  try {
    const deleted = await this.cloudflareService.deleteImage(record.cloudflareId);
    console.log("Cloudflare delete success?", deleted);
  } catch (error) {
    this.fastify.log.warn(`Failed to delete Cloudflare image ${record.cloudflareId}:`, error);
  }

  // Delete from DB
    return await this.mediaService.delete(mediaId);
  }
  
   // Delete media by resource
  async deleteByResource(
    resourceType: MediaResourceType,
    resourceId: string,
    tag?: MediaTag
  ): Promise<number> {
    // Get all media first
    const existingMedia = await this.mediaService.getByResource(resourceType, resourceId, tag);
  
    // Delete from Cloudflare
    for (const record of existingMedia) {
      try {
        const deleted = await this.cloudflareService.deleteImage(record.cloudflareId);
        console.log("Cloudflare delete success?", deleted);
      } catch (error) {
        this.fastify.log.warn(`Failed to delete Cloudflare image ${record.cloudflareId}:`, error);
      }
    }
  
    // Delete from DB
    return await this.mediaService.deleteByResource(resourceType, resourceId, tag);
  }

  // Private helper methods
  private validateUploadOptions(file: UploadFile, options: UploadOptions): void {
    // Validate file size
    if (options.maxFileSize && file.buffer.length > options.maxFileSize) {
      throw new Error(`File size exceeds limit of ${options.maxFileSize} bytes`);
    }

    // Validate empty file
    if (file.buffer.length === 0) {
      throw new Error('Empty file uploaded');
    }

    // Validate image type
    if (options.validateImageType !== false && !file.mimetype.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    // Validate specific mime types
    if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} not allowed. Allowed types: ${options.allowedMimeTypes.join(', ')}`);
    }
  }
  private async replaceExistingMedia(context: UploadContext): Promise<void> {
    try {

      const existingMedia = await this.mediaService.getByResource(
      context.resourceType,
      context.resourceId,
      context.tag
    );

     for (const record of existingMedia) {
      try {
        await this.cloudflareService.deleteImage(record.cloudflareId);
      } catch (error) {
        this.fastify.log.warn(`Failed to delete Cloudflare image ${record.cloudflareId}:`, error);
      }
    }
      await this.mediaService.deleteByResource(
        context.resourceType,
        context.resourceId,
        context.tag
      );
    } catch (error) {
      this.fastify.log.warn(`Failed to delete existing media:`, error);
    }
  }

  private async determinePosition(context: UploadContext, isReplacing: boolean,useGlobalPositioning: boolean = false): Promise<number> {
    if ( context.position !== undefined) {
      return context.position || 0;
    }
    if (isReplacing) {
      return 0;
    }
 // existing media to determine next position
    let existingMedia: Media[];

    // Get existing media to determine next position
    if (useGlobalPositioning) {
      // For posts: consider ALL media regardless of tag
      existingMedia = await this.mediaService.getByResource(
        context.resourceType,
        context.resourceId
        // Don't pass tag - get all media for this resource
      );
    } else {
      // For other resources: only consider media with the same tag
      existingMedia = await this.mediaService.getByResource(
        context.resourceType,
        context.resourceId,
        context.tag
      );
    }
     if (existingMedia.length === 0) {
      return 0;
    }
    return Math.max(...existingMedia.map(m => m.position || 0)) + 1;
  }

  private async processUpload(
    file: UploadFile,
    context: UploadContext,
    position: number
  ): Promise<UploadResult> {
    // Clean filename
    const cleanFilename = file.filename || `${context.tag}-${Date.now()}.${file.mimetype.split('/')[1]}`;

    // Upload to Cloudflare
    let uploadResponse;
    try {
      // Try simple upload first
      uploadResponse = await this.cloudflareService.uploadImageSimple(file.buffer, cleanFilename);
    } catch (simpleError) {
      // If simple fails, try with metadata
      const metadata = {
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        tag: context.tag,
        originalName: file.filename || 'unknown',
        mimetype: file.mimetype,
        ...(context.actualUserId && { userId: context.actualUserId }),
        ...(context.businessId && { businessId: context.businessId }),
        ...context.metadata
      };

      uploadResponse = await this.cloudflareService.uploadImage(
        file.buffer,
        cleanFilename,
        metadata
      );
    }
    if (!uploadResponse.success) {
      throw new Error(`Cloudflare upload failed: ${JSON.stringify(uploadResponse.errors)}`);
    }
    // Generate URLs
    const deliveryUrl = this.cloudflareService.getDeliveryUrl(uploadResponse.result.id);
    const thumbnailUrl = this.cloudflareService.getDeliveryUrl(uploadResponse.result.id, 'thumbnail');

    // Create media record
    const mediaRecord = await this.mediaService.create({
      cloudflareId: uploadResponse.result.id,
      filename: uploadResponse.result.filename,
      originalFilename: file.filename||'',
      mimeType: file.mimetype,
      size: file.buffer.length,
      url: deliveryUrl,
      thumbnailUrl: thumbnailUrl,
      resourceType: context.resourceType,
      resourceId: context.resourceId,
      tag: context.tag,
      position: position,
      variants: { public: deliveryUrl, thumbnail: thumbnailUrl },
      metadata: {
        ...context.metadata,
        originalUploadContext: context.resourceType
      },
      authUserId: context.authUserId
    });
    return {
      id: mediaRecord.id,
      url: mediaRecord.url,
      thumbnailUrl: mediaRecord.thumbnailUrl || "",
      cloudflareId: mediaRecord.cloudflareId,
      filename: mediaRecord.filename,
      size: mediaRecord.size,
      position: mediaRecord.position || 0
    };
  }
}