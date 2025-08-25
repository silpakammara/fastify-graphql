import { eq, and, desc, sql, inArray, or, ilike } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { postUpdates } from '../models/post_updates';
import { favourites } from '../models/favourites';
import { ResourceDescriptor, UniversalMediaHelper } from './UniversalMediaHelper';
import { filterValidUUIDs} from '../utils/uuidValidator';
import { sanitizeField } from '../utils/sanitizedData';


export class PostServiceDrizzleQueryOptimized {
   private mediaHelper: UniversalMediaHelper;
  constructor(private db: NodePgDatabase<any>) {
    this.mediaHelper = new UniversalMediaHelper(db);
  }


  async findById(id: string, currentUserId?: string) {
    // Use query API with specific columns
    const post = await this.db.query.postUpdates.findFirst({
      where: eq(postUpdates.id, id),
      columns: {
        id: true,
        content: true,
        status: true,
        publishedAt: true,
        featured: true,
        postByBusinessId: true,
        postByUserId: true,
        videoUrl: true,
        backgroundTheme: true,
        feeling: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        postByUser: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
          with: {
            profession: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        postByBusiness: {
          columns: {
            id: true,
            companyName: true,
            category: true,
            logo: true,
          },
        },
        comments: {
          columns: {
            id: true,
          },
        },
      },
    });

    if (!post) return null;
     const descriptors: ResourceDescriptor[] = [];

     descriptors.push({
      resourceType: 'post',
      ids: [post.id],
      tags: ['featured_image', 'gallery']
    });

    if (post.postByUser?.id) {
      descriptors.push({
        resourceType: 'user_profile',
        ids: [post.postByUser.id],
        tags: ['profile_pic']
      });
    }

    // Business logos
    if (post.postByBusiness?.id) {
      descriptors.push({
        resourceType: 'business',
        ids: [post.postByBusiness.id],
        tags: ['logo']
      });
    }

     const { featuredImages, galleries, profilePics, businessLogos } = 
      await this.mediaHelper.getMediaMapsForResources(descriptors);

    // Get likes count and check if current user liked
    const [likesData] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(favourites)
      .where(
        and(
          eq(favourites.likedTypeId, id),
          eq(favourites.likedType, 'post')
        )
      );
    
    const likesCount = likesData?.count || 0;
    
    let isLiked = false;
    if (currentUserId) {
      const [userLike] = await this.db
        .select({ id: favourites.id })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, currentUserId),
            eq(favourites.likedTypeId, id),
            eq(favourites.likedType, 'post') 
          )
        )
        .limit(1);
      isLiked = !!userLike;
    }
    
    const commentsCount = post.comments?.length || 0;
    const featuredImage = featuredImages.get(post.id);
    const galleryImages = galleries.get(post.id) || [];
    const userProfilePic = post.postByUser?.id ? profilePics.get(post.postByUser.id) : null;
    const businessLogo = post.postByBusiness?.id ? businessLogos.get(post.postByBusiness.id) : null;
    
    console.log('Post content before transform:', {
      id: post.id,
      content: post.content,
      hasContent: !!post.content,
      contentLength: post.content?.length
    });
    
    const transformedPost = {
      ...post,
      content: post.content || '', // Ensure content is included with fallback
      featuredImage: featuredImage?.url || null,
       userId: post.postByUserId, // Add this for easier access
       businessId: post.postByBusinessId, // Add this for easier access
      images: galleryImages.map((img:any, index:any) => ({
        imgid: img.id,
        postId: post.id,
        imageUrl: img.url || null,
      })),
      userDetails: post.postByUser ? {
        id: post.postByUser.id,
        name: `${post.postByUser.firstName} ${post.postByUser.lastName}`,
        firstName: post.postByUser.firstName,
        lastName: post.postByUser.lastName,
        profilePic: userProfilePic ? {
    id: userProfilePic.id,
    url: userProfilePic.url,
  } : null,
  profession: post.postByUser.profession ? {
    id: post.postByUser.profession.id,
    name: post.postByUser.profession.name,
  } : null,
      } : null,
      businessDetails: post.postByBusiness ? {
        id: post.postByBusiness.id,
        name: post.postByBusiness.companyName,
        category: post.postByBusiness.category,
      logo: businessLogo?.url || null,
      } : null,
      likesCount,
      commentsCount,
      isLiked,
      // Remove relations from response
      comments: undefined,
         postByBusiness: undefined,
        postByUser: undefined,
    };
    
    console.log('Transformed post result:', {
      id: transformedPost.id,
      content: transformedPost.content,
      hasContent: !!transformedPost.content,
      contentLength: transformedPost.content?.length,
      userId: transformedPost.userId,
      postByUserId: transformedPost.postByUserId
    });
    
    return transformedPost;
  }

  async list(filters: {
    status?: string | undefined;
    featured?: boolean | undefined;
    userId?: string | undefined;
    businessId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    location?: string | undefined;
  }, currentUserId?: string) {
    const limit = filters.limit || 10;
    const offset = filters.offset || 0;

    // Build where conditions
    const conditions = [];
    if (filters.status) {
      conditions.push(ilike(postUpdates.status, `%${filters.status}%`));
    }
    if (filters.featured !== undefined) {
      conditions.push(eq(postUpdates.featured, filters.featured));
    }
    if (filters.userId) {
      conditions.push(eq(postUpdates.postByUserId, filters.userId));
    }
    if (filters.businessId) {
      conditions.push(eq(postUpdates.postByBusinessId, filters.businessId));
    }
    if (filters.location) {
      conditions.push(ilike(postUpdates.location, `%${filters.location}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get posts with relations using query API with specific columns
    const posts = await this.db.query.postUpdates.findMany({
      where: whereClause,
      columns: {
        id: true,
        content: true,
        status: true,
        publishedAt: true,
        featured: true,
        postByBusinessId: true,
        postByUserId: true,
        videoUrl: true,
        backgroundTheme: true,
        feeling: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        
        postByUser: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
          with: {
            profession: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
        postByBusiness: {
          columns: {
            id: true,
            companyName: true,
            logo: true,
          },
        },
        comments: {
          columns: {
            id: true,
          },
        },
      },
      orderBy: desc(postUpdates.publishedAt),
      limit,
      offset,
    });

    // Get total count
     const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;

    // Get all post IDs for batch operations
    const descriptors: ResourceDescriptor[] = [];
    const postIds = posts.map((p: any) => p.id);
    const userIds = posts.map((p: any) => p.postByUser?.id).filter(Boolean);
    const businessIds = posts.map((p: any) => p.postByBusiness?.id).filter(Boolean);

     if (postIds.length > 0) {
      descriptors.push({
        resourceType: 'post',
        ids: postIds,
        tags: ['featured_image', 'gallery']
      });
    }

    if (userIds.length > 0) {
      descriptors.push({
        resourceType: 'user_profile',
        ids: userIds,
        tags: ['profile_pic']
      });
    }

    if (businessIds.length > 0) {
      descriptors.push({
        resourceType: 'business',
        ids: businessIds,
        tags: ['logo']
      });
    }
console.log('descriptions', descriptors)
     const { featuredImages, galleries, profilePics, businessLogos } = 
      await this.mediaHelper.getMediaMapsForResources(descriptors);
      console.log('feature,galleries,profile, business',featuredImages,galleries,profilePics,businessIds)

    // Get likes counts for all posts
    const likesData = postIds.length > 0
      ? await this.db
          .select({
            postId: favourites.likedTypeId,
            count: sql<number>`count(*)::int`
          })
          .from(favourites)
          .where(
            and(
              inArray(favourites.likedTypeId, postIds),
              eq(favourites.likedType, 'post')
            )
          )
          .groupBy(favourites.likedTypeId)
      : [];
    
    const likesMap = new Map(likesData.map(l => [l.postId, l.count]));
    
    // Get user's likes if authenticated
    let userLikes = new Set<string>();
    if (currentUserId && postIds.length > 0) {
      const likes = await this.db
        .select({ postId: favourites.likedTypeId })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, currentUserId),
            inArray(favourites.likedTypeId, postIds),
            eq(favourites.likedType, 'post')
          )
        );
      userLikes = new Set(likes.map(l => l.postId));
    }

    // Transform posts
    const transformedPosts = posts.map((post:any) => {
      const likesCount = likesMap.get(post.id) || 0;
      const isLiked = userLikes.has(post.id);
      const commentsCount = post.comments?.length || 0;

      const featuredImage = featuredImages.get(post.id);
      const galleryImages = galleries.get(post.id) || [];
      const userProfilePic = post.postByUser?.id ? profilePics.get(post.postByUser.id) : null;
    const businessLogo = post.postByBusiness?.id ? businessLogos.get(post.postByBusiness.id) : null;

      // Debug log
      if (!post.content) {
        console.log('WARNING: Post missing content:', {
          id: post.id,
          hasContent: 'content' in post,
          contentValue: post.content,
          postKeys: Object.keys(post)
        });
      }

      return {
        ...post,
        content: post.content || '', // Ensure content is included with fallback
        featuredImage: featuredImage?.url || null,
        images: galleryImages.map((img:any, index:any) => ({
        imgid: img.id,
        postId: post.id,
        imageUrl: img.url||null,
      })),
        userDetails: post.postByUser ? {
          id: post.postByUser.id,
          name: `${post.postByUser.firstName} ${post.postByUser.lastName}`,
          firstName: post.postByUser.firstName,
          lastName: post.postByUser.lastName,
          profilePic: userProfilePic ? {
    id: userProfilePic.id,
    url: userProfilePic.url,
  } : null,
  profession: post.postByUser.profession ? {
    id: post.postByUser.profession.id,
    name: post.postByUser.profession.name,
  } : null,
        } : null,
        businessDetails: post.postByBusiness ? {
          id: post.postByBusiness.id,
          name: post.postByBusiness.companyName,
          logo: businessLogo?.url || null,
        } : null,
        likesCount,
        commentsCount,
        isLiked,
        // Remove relations from response
        comments: undefined,
        postByBusiness: undefined,
        postByUser: undefined,
      };
    });

    return {
      data: transformedPosts,
      total: count,
      limit,
      offset,
    };
  }

 async create(data: any) {
  const [newPost] = await this.db
    .insert(postUpdates)
    .values({
      ...data,
      status: data.status && data.status.trim() !== '' ? data.status : 'published',
      // postByBusinessId: sanitizeField(data.postByBusinessId),
      featuredImage: sanitizeField(data.featuredImage),
      videoUrl: sanitizeField(data.videoUrl),
      images: filterValidUUIDs(Array.isArray(data.images) ? data.images : []),
      backgroundTheme: sanitizeField(data.backgroundTheme), 
      feeling: sanitizeField(data.feeling),
      location: sanitizeField(data.location),
      publishedAt: data.publishedAt || new Date(),
    })
    .returning();

  return newPost || null;
}

  async update(id: string, data: any, currentUserId?: string) {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        ...data,
      status: data.status && data.status.trim() !== '' ? data.status : 'published',
      featuredImage: sanitizeField(data.featuredImage),
      videoUrl: sanitizeField(data.videoUrl),
      images: sanitizeField(
        data.images && data.images.length > 0 ? filterValidUUIDs(data.images) : null
      ),
      backgroundTheme: sanitizeField(data.backgroundTheme),
      feeling: sanitizeField(data.feeling),
      location: sanitizeField(data.location),
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    if (!updated) return null;
    
    return this.findById(updated.id, currentUserId);
  }

  async delete(id: string) {
    await this.db
      .delete(postUpdates)
      .where(eq(postUpdates.id, id));
  }

  async getUserFeed(userId: string, options: { limit?: number | undefined; offset?: number | undefined } = {}) {
    return this.list({
      userId,
      status: 'published',
      ...options,
    });
  }
}