import { eq, and, desc, sql, or, inArray, like, gte } from 'drizzle-orm';
import { media, type Media, type NewMedia } from '../models/media';
import { user } from '../models/user';
import { postUpdates } from '../models/post_updates';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CloudflareImagesService } from './cloudflareService';
import type { FastifyInstance } from 'fastify';
import { ResourceDescriptor, UniversalMediaHelper } from './UniversalMediaHelper';
import { businessDetails } from '../models/business_details';

export interface UploadResult {
  media: Media;
  variants: Record<string, string>;
}

export class MediaService {
  private cloudflare: CloudflareImagesService;

  constructor(
    private db: NodePgDatabase<any>,
    private fastify: FastifyInstance
  ) {
    this.cloudflare = new CloudflareImagesService(fastify);
  }

  /**
   * Upload a new image
   */
  async uploadImage(
    userId: string,
    file: Buffer,
    filename: string,
    mimeType: string,
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    // Prepare metadata with useful information
    const enrichedMetadata = {
      userId,
      environment: this.fastify.config.NODE_ENV,
      originalFilename: filename,
      mimeType,
      sizeBytes: String(file.length),
      ...metadata
    };

    // Upload to Cloudflare
    const cloudflareResult = await this.cloudflare.uploadImage(
      file,
      filename,
      enrichedMetadata
    );

    if (!cloudflareResult.success) {
      throw new Error('Failed to upload to Cloudflare');
    }

    // Get variant URLs
    const variants = await this.cloudflare.getVariantUrls(cloudflareResult.result.id);

    // Find user profile ID from auth user ID
    const [userProfile] = await this.db
      .select()
      .from(user)
      .where(eq(user.userAuthId, userId))
      .limit(1);

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Save to database with resource pattern
    const [newMedia] = await this.db
      .insert(media)
      .values({
        cloudflareId: cloudflareResult.result.id,
        filename: cloudflareResult.result.filename,
        originalFilename: filename,
        mimeType,
        size: file.length,
        url: this.cloudflare.getDeliveryUrl(cloudflareResult.result.id),
        thumbnailUrl: variants.thumbnail || null,
        variants,
        metadata,
        resourceType: 'user_profile',
        resourceId: userProfile.id,
        tag: 'attachment',
        position: 0,
      })
      .returning();

    return {
      media: newMedia!,
      variants,
    };
  }

  /**
   * Upload image from URL
   */
  async uploadFromUrl(
    userId: string,
    url: string,
    metadata?: Record<string, any>
  ): Promise<UploadResult> {
    // Prepare metadata with useful information
    const enrichedMetadata = {
      userId,
      environment: this.fastify.config.NODE_ENV,
      sourceUrl: url,
      uploadType: 'url',
      ...metadata
    };

    // Upload to Cloudflare
    const cloudflareResult = await this.cloudflare.uploadFromUrl(url, enrichedMetadata);

    if (!cloudflareResult.success) {
      throw new Error('Failed to upload from URL to Cloudflare');
    }

    // Get variant URLs
    const variants = await this.cloudflare.getVariantUrls(cloudflareResult.result.id);

    // Find user profile ID from auth user ID
    const [userProfile] = await this.db
      .select()
      .from(user)
      .where(eq(user.userAuthId, userId))
      .limit(1);

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Save to database with resource pattern
    const [newMedia] = await this.db
      .insert(media)
      .values({
        cloudflareId: cloudflareResult.result.id,
        filename: cloudflareResult.result.filename,
        originalFilename: url.split('/').pop() || 'image',
        mimeType: 'image/jpeg', // Default, Cloudflare will handle conversion
        size: 0, // Unknown for URL uploads
        url: this.cloudflare.getDeliveryUrl(cloudflareResult.result.id),
        thumbnailUrl: variants.thumbnail || null,
        variants,
        metadata,
        resourceType: 'user_profile',
        resourceId: userProfile.id,
        tag: 'attachment',
        position: 0,
      })
      .returning();

    return {
      media: newMedia!,
      variants,
    };
  }

  /**
   * Get media by ID
   */
  async getById(id: string, userId?: string): Promise<Media | null> {
    let conditions = eq(media.id, id);
    
    // If userId provided, ensure the media belongs to the user
    if (userId) {
      const [userProfile] = await this.db
        .select()
        .from(user)
        .where(eq(user.userAuthId, userId))
        .limit(1);
      
      if (userProfile) {
        conditions = and(
          eq(media.id, id),
          eq(media.resourceType, 'user_profile'),
          eq(media.resourceId, userProfile.id)
        );
      }
    }

    const [result] = await this.db
      .select()
      .from(media)
      .where(conditions)
      .limit(1);

    return result || null;
  }

  /**
   * Get media by Cloudflare ID
   */
  async getByCloudflareId(cloudflareId: string, userId?: string): Promise<Media | null> {
    let conditions = eq(media.cloudflareId, cloudflareId);
    
    // If userId provided, ensure the media belongs to the user
    if (userId) {
      const [userProfile] = await this.db
        .select()
        .from(user)
        .where(eq(user.userAuthId, userId))
        .limit(1);
      
      if (userProfile) {
        conditions = and(
          eq(media.cloudflareId, cloudflareId),
          eq(media.resourceType, 'user_profile'),
          eq(media.resourceId, userProfile.id)
        );
      }
    }

    const [result] = await this.db
      .select()
      .from(media)
      .where(conditions)
      .limit(1);

    return result || null;
  }

  /**
   * List user's media with pagination
   */
  async listUserMedia(
    userId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: Media[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Find user profile ID from auth user ID
    const [userProfile] = await this.db
      .select()
      .from(user)
      .where(eq(user.userAuthId, userId))
      .limit(1);

    if (!userProfile) {
      return { items: [], total: 0, page, totalPages: 0 };
    }

    // Get media for this user profile
    const items = await this.db
      .select()
      .from(media)
      .where(
        and(
          eq(media.resourceType, 'user_profile'),
          eq(media.resourceId, userProfile.id)
        )
      )
      .orderBy(desc(media.uploadedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(
        and(
          eq(media.resourceType, 'user_profile'),
          eq(media.resourceId, userProfile.id)
        )
      );

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      totalPages,
    };
  }

  /**
   * Delete media
   */
  async deleteMedia(id: string, userId: string): Promise<boolean> {
  // Check if the media belongs to the user
  const mediaRecord = await this.db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.authUserId, userId)))
    .limit(1);

  if (mediaRecord.length === 0) {
    throw new Error('Media not found or not owned by user');
  }

  // Delete from database
  const result = await this.db
    .delete(media)
    .where(and(eq(media.id, id), eq(media.authUserId, userId)));

  if (result.rowCount === 0) {
    throw new Error('Failed to delete media');
  }

  return true;
}
  /**
   * Update media metadata
   */
  async updateMetadata(
    id: string,
    userId: string,
    metadata: Record<string, any>
  ): Promise<Media> {
    const [updated] = await this.db
      .update(media)
      .set({ metadata })
      .where(and(eq(media.id, id), eq(media.userId, userId)))
      .returning();

    if (!updated) {
      throw new Error('Media not found');
    }

    return updated;
  }

  /**
   * Get user's gallery (profile pics and post images)
   */
  async getUserGallery(
    userId: string,
    filters: {
      type?: 'profile' | 'posts' | 'all';
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      url: string;
      thumbnailUrl: string | null;
      type: 'profile' | 'post';
      uploadedAt: Date;
      metadata?: any;
    }>;
    total: number;
  }> {
    const { type = 'all', limit = 20, offset = 0 } = filters;
    const items: any[] = [];
    let total = 0;

    // Get user profile to find profile pic
    if (type === 'profile' || type === 'all') {
      const [userProfile] = await this.db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userProfile?.profilePic) {
        // Profile pics are stored as media IDs
        const [profileMedia] = await this.db
          .select()
          .from(media)
          .where(eq(media.id, userProfile.profilePic))
          .limit(1);

        if (profileMedia) {
          items.push({
            id: profileMedia.id,
            url: profileMedia.url,
            thumbnailUrl: profileMedia.thumbnailUrl,
            type: 'profile',
            uploadedAt: profileMedia.uploadedAt,
            metadata: profileMedia.metadata,
          });
          total++;
        }
      }
    }

    // Get post images
    if (type === 'posts' || type === 'all') {
      const posts = await this.db
        .select({
          images: postUpdates.images,
          featuredImage: postUpdates.featuredImage,
          createdAt: postUpdates.createdAt,
        })
        .from(postUpdates)
        .where(eq(postUpdates.postByUserId, userId))
        .orderBy(desc(postUpdates.createdAt));

      // Extract all image IDs from posts
      const imageIds: string[] = [];
      posts.forEach(post => {
        if (post.featuredImage) imageIds.push(post.featuredImage);
        if (post.images) imageIds.push(...post.images);
      });

      if (imageIds.length > 0) {
        const postMedia = await this.db
          .select()
          .from(media)
          .where(inArray(media.id, imageIds))
          .limit(limit)
          .offset(offset);

        postMedia.forEach(m => {
          items.push({
            id: m.id,
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            type: 'post',
            uploadedAt: m.uploadedAt,
            metadata: m.metadata,
          });
        });

        total += postMedia.length;
      }
    }

    return { items, total };
  }

    //all gallery api data  
    async getAllGalleryData(
      filters: {
        type?: 'profile' | 'posts' | 'all';
        limit?: number;
        offset?: number;
      }
    ): Promise<{
      items: Array<{
        id: string;
        url: string;
        type: 'profile' | 'post';
        user?: {
          id: string;
          name: string;
          profilePicUrl?: string;
        };
        business?: {
          id: string;
          name: string;
          logoUrl?: string;
        };
        post?: {
          id: string;
          content?: string;
          createdAt: Date;
          imageCount: number;
          images: Array<{
            id: string;
            url: string;
            imageType: 'featured' | 'gallery';
          }>;
        };
      }>;
      total: number;
    }> {
      const { type = 'all', limit = 20, offset = 0 } = filters;
      const mediaHelper = new UniversalMediaHelper(this.db);
      
      // Build resource descriptors for batch fetching
      const resourceDescriptors: ResourceDescriptor[] = [];
      
      if (type === 'profile' || type === 'all') {
        // Get all user IDs
        const users = await this.db.select({ id: user.id }).from(user);
        if (users.length > 0) {
        resourceDescriptors.push({
          resourceType: 'user_profile',
          ids: users.map(u => u.id),
          tags: ['profile_pic']
        });
        }

        // Get all business IDs for business logos in profiles
        const businesses = await this.db.select({ id: businessDetails.id }).from(businessDetails);
        if (businesses.length > 0) {
          resourceDescriptors.push({
            resourceType: 'business',
            ids: businesses.map(b => b.id),
            tags: ['logo']
          });
        }
      }
      
      if (type === 'posts' || type === 'all') {
        // Get all post IDs
        const allPosts = await this.db.select({ id: postUpdates.id }).from(postUpdates);
        if (allPosts.length > 0) {
        resourceDescriptors.push({
          resourceType: 'post',
          ids: allPosts.map(p => p.id),
          tags: ['featured_image', 'gallery']
        });
        }
      }
      
      // Fetch all media using UniversalMediaHelper
      const mediaMaps = await mediaHelper.getMediaMapsForResources(resourceDescriptors);
      
      // Get all required data in parallel
      const [users, businesses, posts] = await Promise.all([
        this.db.select().from(user),
        this.db.select().from(businessDetails),
        this.db.select().from(postUpdates)
      ]);
      
      // Create maps for quick access
      const userMap = new Map(users.map(u => [u.id, u]));
      const businessMap = new Map(businesses.map(b => [b.id, b]));
      const postMap = new Map(posts.map(p => [p.id, p]));
      
      const items: any[] = [];
      
      // Process profile pics
      if (type === 'profile' || type === 'all') {
        mediaMaps.profilePics.forEach((media, userId) => {
          const user = userMap.get(userId);
          if (user) {
            items.push({
              id: media.id,
              url: media.url,
              type: 'profile',
              user: {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                profilePicUrl: media.url,
              },
            });
          }
        });

        // Process business logos as profile items
        mediaMaps.businessLogos.forEach((media, businessId) => {
          const business = businessMap.get(businessId);
          if (business) {
            items.push({
              id: media.id,
              url: media.url,
              type: 'profile',
              business: {
                id: business.id,
                name: business.name,
                logoUrl: media.url,
              },
            });
          }
        });
      }

      //  both user and business posts
      if (type === 'posts' || type === 'all') {
        const processedPosts = new Set<string>();
        
        // Get all posts with media (both user and business posts)
        const postsWithMedia = new Set([
          ...Array.from(mediaMaps.featuredImages.keys()),
          ...Array.from(mediaMaps.galleries.keys())
        ]);
        
        postsWithMedia.forEach(postId => {
          if (processedPosts.has(postId)) return;
          
          // Get the post (could be user or business post)
          const post = postMap.get(postId);
          if (!post) return;
          
          // Determine post owner and type
          let postOwner = null;
          let ownerType: 'user' | 'business' = 'user';
          
          if (post.postByUserId) {
            postOwner = userMap.get(post.postByUserId);
            ownerType = 'user';
          } else if (post.postByBusinessId) {
            postOwner = businessMap.get(post.postByBusinessId);
            ownerType = 'business';
          }
          
          if (post && postOwner) {
            //profile pic/logo of the users 
            const ownerMedia = ownerType === 'user' 
              ? mediaMaps.profilePics.get(postOwner.id)
              : mediaMaps.businessLogos.get(postOwner.id);
            
            // Collect all images for  post
            const postImages: Array<{
              id: string;
              url: string;
              imageType: 'featured' | 'gallery';
            }> = [];
            
            // Add featured image if exists
            const featuredImage = mediaMaps.featuredImages.get(postId);
            if (featuredImage) {
              postImages.push({
                id: featuredImage.id,
                url: featuredImage.url,
                imageType: 'featured'
              });
            }
            
            // Add gallery images if exist
            const galleryImages = mediaMaps.galleries.get(postId);
            if (galleryImages) {
              galleryImages.forEach(media => {
                postImages.push({
                  id: media.id,
                  url: media.url,
                  imageType: 'gallery'
                });
              });
            }
            
            // Only add if there are images
            if (postImages.length > 0) {
              const itemData: any = {
                type: 'post',
                post: {
                  id: post.id,
                  content: post.content,
                  createdAt: post.createdAt,
                  imageCount: postImages.length,
                  images: postImages,
                },
              };

              // Add owner information based on type
              if (ownerType === 'user') {
                itemData.user = {
                  id: postOwner.id,
                  name: `${postOwner.firstName} ${postOwner.lastName}`,
                  profilePicUrl: ownerMedia?.url,
                };
              } else {
                itemData.business = {
                  id: postOwner.id,
                  name: postOwner.name,
                  logoUrl: ownerMedia?.url,
                };
              }
              items.push(itemData);
            }
            processedPosts.add(postId);
          }
        });
      }
      // Sort by creation date (newest first)
      items.sort((a, b) => {
        const dateA = a.post?.createdAt || a.user?.createdAt || a.business?.createdAt || new Date(0);
        const dateB = b.post?.createdAt || b.user?.createdAt || b.business?.createdAt || new Date(0);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
      const total = items.length;
      const paginatedItems = items.slice(offset, offset + limit);
      return { items: paginatedItems, total };
 }

  /**
   * Get all media by type/category
   */
  async getMediaByType(
    filters: {
      userId?: string;
      mimeType?: string;
      metadata?: Record<string, any>;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    items: Media[];
    total: number;
  }> {
    const conditions = [];
    
    if (filters.userId) {
      conditions.push(eq(media.authUserId, filters.userId));
    }

    if (filters.mimeType) {
      conditions.push(like(media.mimeType, `${filters.mimeType}%`));
    }

    if (filters.metadata) {
      Object.entries(filters.metadata).forEach(([key, value]) => {
        conditions.push(sql`${media.metadata}->>${key} = ${value}`);
      });
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(media)
      .where(whereClause);

    // Get paginated results
    const items = await this.db
      .select()
      .from(media)
      .where(whereClause)
      .limit(filters.limit || 20)
      .offset(filters.offset || 0)
      .orderBy(desc(media.uploadedAt));

    return {
      items,
      total: count,
    };
  }

  /**
   * Get media statistics
   */
  async getMediaStats(userId?: string): Promise<{
    totalImages: number;
    totalSize: number;
    byMimeType: Array<{ mimeType: string; count: number; totalSize: number }>;
    recentUploads: number;
  }> {
    const userCondition = userId ? eq(media.userId, userId) : undefined;

    // Total images and size
    const [totals] = await this.db
      .select({
        totalImages: sql<number>`count(*)::int`,
        totalSize: sql<number>`COALESCE(SUM(${media.size}), 0)::bigint`,
      })
      .from(media)
      .where(userCondition);

    // By mime type
    const byMimeType = await this.db
      .select({
        mimeType: media.mimeType,
        count: sql<number>`count(*)::int`,
        totalSize: sql<number>`COALESCE(SUM(${media.size}), 0)::bigint`,
      })
      .from(media)
      .where(userCondition)
      .groupBy(media.mimeType)
      .orderBy(sql`count(*) DESC`);

    // Recent uploads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [recent] = await this.db
      .select({
        recentUploads: sql<number>`count(*)::int`,
      })
      .from(media)
      .where(
        and(
          userCondition,
          gte(media.uploadedAt, sevenDaysAgo)
        )
      );

    return {
      totalImages: totals.totalImages,
      totalSize: Number(totals.totalSize),
      byMimeType: byMimeType.map(item => ({
        mimeType: item.mimeType,
        count: item.count,
        totalSize: Number(item.totalSize),
      })),
      recentUploads: recent.recentUploads,
    };
  }

  /**
   * Bulk delete media
   */
  async bulkDeleteMedia(mediaIds: string[], userId: string): Promise<{
    deleted: number;
    failed: number;
  }> {
    let deleted = 0;
    let failed = 0;

    // Get all media records
    const mediaRecords = await this.db
      .select()
      .from(media)
      .where(
        and(
          inArray(media.id, mediaIds),
          eq(media.userId, userId)
        )
      );

    // Delete from Cloudflare and database
    for (const record of mediaRecords) {
      try {
        await this.cloudflare.deleteImage(record.cloudflareId);
        await this.db
          .delete(media)
          .where(eq(media.id, record.id));
        deleted++;
      } catch (error) {
        failed++;
        this.fastify.log.error(`Failed to delete media ${record.id}:`, error);
      }
    }

    return { deleted, failed };
  }
}