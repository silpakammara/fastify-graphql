import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { postUpdates } from '../models/post_updates';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import { professions } from '../models/professions';
import { favourites } from '../models/favourites';
import { comments } from '../models/comments';
import { media } from '../models/media';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { filterValidUUIDs } from '../utils/uuidValidator';

export class PostServiceDrizzle {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: string, currentUserId?: string) {
    // First check if we need to set up relations
    const hasRelations = this.db.query?.postUpdates;
    
    let post: any;
    
    if (hasRelations) {
      // Use query API if available
      post = await this.db.query.postUpdates.findFirst({
        where: eq(postUpdates.id, id),
        with: {
          postByUser: {
            with: {
              profession: true,
            },
          },
          postByBusiness: true,
        },
      });
    } else {
      // Fallback to manual joins
      const result = await this.db
        .select({
          post: postUpdates,
          postByUser: user,
          postByBusiness: businessDetails,
          profession: professions,
        })
        .from(postUpdates)
        .leftJoin(user, eq(user.id, postUpdates.postByUserId))
        .leftJoin(professions, eq(professions.id, user.professionId))
        .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusinessId))
        .where(eq(postUpdates.id, id))
        .limit(1);
      
      if (!result.length) return null;
      
      const [row] = result;
      post = {
        ...row.post,
        postByUser: row.postByUser ? {
          ...row.postByUser,
          profession: row.profession,
        } : null,
        postByBusiness: row.postByBusiness,
      };
    }

    if (!post) return null;

    // Get media
    const mediaIds = [
      post.featuredImage,
      ...(post.images || [])
    ].filter(Boolean) as string[];

    const validMediaIds = filterValidUUIDs(mediaIds);
    
    const mediaRecords = validMediaIds.length > 0
      ? await this.db
          .select()
          .from(media)
          .where(inArray(media.id, validMediaIds))
      : [];

    // Create media map
    const mediaMap = new Map(
      mediaRecords.map(m => [
        m.id,
        {
          id: m.id,
          url: m.url ? `${m.url.replace(/\/\w+$/, '')}/public` : null
        }
      ])
    );

    // Get counts
    const [likesData, commentsData] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(favourites)
        .where(
          and(
            eq(favourites.likedTypeId, id),
            eq(favourites.likedType, 'post')
          )
        ),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(comments)
        .where(eq(comments.postUpdatesId, id))
    ]);

    const likesCount = likesData[0]?.count || 0;
    const commentsCount = commentsData[0]?.count || 0;

    // Check if current user liked
    let isLiked = false;
    if (currentUserId) {
      const [liked] = await this.db
        .select()
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, currentUserId),
            eq(favourites.likedTypeId, id),
            eq(favourites.likedType, 'post')
          )
        )
        .limit(1);
      isLiked = !!liked;
    }

    // Transform result
    return {
      ...post,
      featuredImage: post.featuredImage ? mediaMap.get(post.featuredImage) || null : null,
      images: (post.images || [])
        .map(id => mediaMap.get(id))
        .filter(Boolean)
        .map((img, index) => {
          if (!img || typeof img !== 'object') {
            console.error('Invalid image object:', img);
            return null;
          }
          return {
            id: img.id,
            postId: post.id,
            imageId: img.id,
            imageUrl: img.url,
            order: index,
            createdAt: post.createdAt,
          };
        })
        .filter(Boolean),
      userDetails: post.postByUser ? {
        id: post.postByUser.id,
        name: `${post.postByUser.firstName} ${post.postByUser.lastName}`,
        firstName: post.postByUser.firstName,
        lastName: post.postByUser.lastName,
        profilePic: post.postByUser.profilePic,
        profession: post.postByUser.profession?.name || null,
      } : null,
      businessDetails: post.postByBusiness ? {
        id: post.postByBusiness.id,
        name: post.postByBusiness.name,
        category: post.postByBusiness.category,
        logo: post.postByBusiness.logo,
      } : null,
      userId: post.postByUser?.id || post.postByUserId,
      likesCount,
      commentsCount,
      isLiked,
    };
  }

  async list(filters: {
    status?: string;
    featured?: boolean;
    userId?: string;
    businessId?: string;
    limit?: number;
    offset?: number;
  }, currentUserId?: string) {
    try {
      console.log('PostServiceDrizzle.list called with:', { filters, currentUserId });
      
      const conditions = [];

      if (filters.status) {
        conditions.push(eq(postUpdates.status, filters.status));
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

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    console.log('Getting total count...');
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;
    console.log('Total count:', count);

    // Get posts with relations
    console.log('Fetching posts with relations...');
    const results = await this.db
      .select({
        post: postUpdates,
        postByUser: user,
        postByBusiness: businessDetails,
        profession: professions,
      })
      .from(postUpdates)
      .leftJoin(user, eq(user.id, postUpdates.postByUserId))
      .leftJoin(professions, eq(professions.id, user.professionId))
      .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusinessId))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(postUpdates.publishedAt));
    
    console.log('Posts fetched:', results.length);
    if (results.length > 0) {
      console.log('First post images field:', {
        images: results[0].post.images,
        type: typeof results[0].post.images,
        isArray: Array.isArray(results[0].post.images)
      });
    }

    // Collect all media IDs
    const allMediaIds = results.flatMap(r => {
      const mediaIds = [];
      if (r.post.featuredImage) {
        mediaIds.push(r.post.featuredImage);
      }
      // Handle images array - it might be a string that needs parsing
      const images = r.post.images;
      if (images) {
        if (Array.isArray(images)) {
          mediaIds.push(...images);
        } else if (typeof images === 'string') {
          try {
            const parsedImages = JSON.parse(images);
            if (Array.isArray(parsedImages)) {
              mediaIds.push(...parsedImages);
            }
          } catch (e) {
            console.error('Failed to parse images:', e);
          }
        }
      }
      return mediaIds;
    });

    const validMediaIds = filterValidUUIDs([...new Set(allMediaIds)]);

    // Fetch all media at once
    const mediaRecords = validMediaIds.length > 0
      ? await this.db
          .select()
          .from(media)
          .where(inArray(media.id, validMediaIds))
      : [];

    // Create media map
    const mediaMap = new Map(
      mediaRecords.map(m => [
        m.id,
        {
          id: m.id,
          url: m.url ? `${m.url.replace(/\/\w+$/, '')}/public` : null
        }
      ])
    );

    // Get all post IDs for counts
    const postIds = results.map(r => r.post.id);

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

    // Get comments counts for all posts
    const commentsData = postIds.length > 0
      ? await this.db
          .select({
            postId: comments.commentUpdateTypeId,
            count: sql<number>`count(*)::int`
          })
          .from(comments)
          .where(inArray(comments.commentUpdateTypeId, postIds))
          .groupBy(comments.commentUpdateTypeId)
      : [];

    const commentsMap = new Map(commentsData.map(c => [c.postId, c.count]));

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

    // Transform results
    const transformedPosts = results.map(({ post, postByUser, postByBusiness, profession }) => {
      try {
        return {
      ...post,
      featuredImage: post.featuredImage ? mediaMap.get(post.featuredImage) || null : null,
      images: (post.images || [])
        .map(id => mediaMap.get(id))
        .filter(Boolean)
        .map((img, index) => {
          if (!img || typeof img !== 'object') {
            console.error('Invalid image object:', img);
            return null;
          }
          return {
            id: img.id,
            postId: post.id,
            imageId: img.id,
            imageUrl: img.url,
            order: index,
            createdAt: post.createdAt,
          };
        })
        .filter(Boolean),
      userDetails: postByUser ? {
        id: postByUser.id,
        name: `${postByUser.firstName} ${postByUser.lastName}`,
        firstName: postByUser.firstName,
        lastName: postByUser.lastName,
        profilePic: postByUser.profilePic,
        profession: profession?.name || null,
      } : null,
      businessDetails: postByBusiness ? {
        id: postByBusiness.id,
        name: postByBusiness.name,
        category: postByBusiness.category,
        logo: postByBusiness.logo,
      } : null,
      userId: postByUser?.id || post.postByUserId,
      likesCount: likesMap.get(post.id) || 0,
      commentsCount: commentsMap.get(post.id) || 0,
      isLiked: userLikes.has(post.id),
        };
      } catch (error) {
        console.error('Error transforming post:', error, { postId: post.id });
        throw error;
      }
    });

    return {
      data: transformedPosts,
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
    } catch (error) {
      console.error('Error in PostServiceDrizzle.list:', error);
      throw error;
    }
  }

  async create(data: any) {
    const [newPost] = await this.db
      .insert(postUpdates)
      .values({
        ...data,
        publishedAt: data.publishedAt || new Date(),
      })
      .returning();
    
    return this.findById(newPost.id);
  }

  async update(id: string, data: any, currentUserId?: string) {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    if (!updated) return null;
    
    return this.findById(updated.id, currentUserId);
  }
}