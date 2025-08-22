import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { postUpdates } from '../models/post_updates';
import { favourites } from '../models/favourites';
import { media } from '../models/media';
import { filterValidUUIDs } from '../utils/uuidValidator';

export class PostServiceDrizzleQuery {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: string, currentUserId?: string) {
    // Use query API to fetch post with relations
    const post = await this.db.query.postUpdates.findFirst({
      where: eq(postUpdates.id, id),
      with: {
        postByUser: {
          with: {
            profession: true,
          },
        },
        postByBusiness: true,
        comments: true,
      },
    });

    if (!post) return null;

    // Get media for images
    const mediaIds = [
      post.featuredImage,
      ...(Array.isArray(post.images) ? post.images : [])
    ].filter(Boolean) as string[];

    const validMediaIds = filterValidUUIDs(mediaIds);
    
    const mediaRecords = validMediaIds.length > 0
      ? await this.db.query.media.findMany({
          where: inArray(media.id, validMediaIds),
        })
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
      isLiked = !!userLike;
    }
    
    const commentsCount = post.comments?.length || 0;

    // Transform result
    return {
      ...post,
      featuredImage: post.featuredImage ? mediaMap.get(post.featuredImage) || null : null,
      images: (Array.isArray(post.images) ? post.images : [])
        .map(id => mediaMap.get(id))
        .filter(Boolean)
        .map((img, index) => ({
          id: img.id,
          postId: post.id,
          imageId: img.id,
          imageUrl: img.url,
          order: index,
          createdAt: post.createdAt,
        })),
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
      // Remove relations from response
      comments: undefined,
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
    const limit = filters.limit || 10;
    const offset = filters.offset || 0;

    // Build where conditions
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

    // Get posts with relations using query API
    const posts = await this.db.query.postUpdates.findMany({
      where: whereClause,
      with: {
        postByUser: {
          with: {
            profession: true,
          },
        },
        postByBusiness: true,
        comments: true,
      },
      orderBy: desc(postUpdates.publishedAt),
      limit,
      offset,
    });

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);

    // Collect all media IDs
    const allMediaIds = posts.flatMap(post => [
      post.featuredImage,
      ...(Array.isArray(post.images) ? post.images : [])
    ].filter(Boolean)) as string[];

    const validMediaIds = filterValidUUIDs([...new Set(allMediaIds)]);

    // Fetch all media at once
    const mediaRecords = validMediaIds.length > 0
      ? await this.db.query.media.findMany({
          where: inArray(media.id, validMediaIds),
        })
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

    // Get all post IDs for batch operations
    const postIds = posts.map(p => p.id);
    
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
    const transformedPosts = posts.map(post => {
      const likesCount = likesMap.get(post.id) || 0;
      const isLiked = userLikes.has(post.id);
      const commentsCount = post.comments?.length || 0;

      return {
        ...post,
        featuredImage: post.featuredImage ? mediaMap.get(post.featuredImage) || null : null,
        images: (Array.isArray(post.images) ? post.images : [])
          .map(id => mediaMap.get(id))
          .filter(Boolean)
          .map((img, index) => ({
            id: img.id,
            postId: post.id,
            imageId: img.id,
            imageUrl: img.url,
            order: index,
            createdAt: post.createdAt,
          })),
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
        // Remove relations from response
        comments: undefined,
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

  async delete(id: string) {
    await this.db
      .delete(postUpdates)
      .where(eq(postUpdates.id, id));
  }

  async getUserFeed(userId: string, options: { limit?: number; offset?: number } = {}) {
    return this.list({
      userId,
      status: 'published',
      ...options,
    });
  }
}