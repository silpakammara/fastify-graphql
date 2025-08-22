import { eq, and, or, like, desc, sql, inArray } from 'drizzle-orm';
import { posts, type Post, type NewPost } from '../models/post';
import { postUpdates } from '../models/post_updates';
import { userProfiles } from '../models/userProfile';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MediaServiceNew } from './mediaServiceNew';
import type { SimpleMediaField } from '../utils/mediaHelpers';

export class PostServiceResource {
  private mediaService: MediaServiceNew;

  constructor(private db: NodePgDatabase<any>) {
    this.mediaService = new MediaServiceNew(db);
  }

  async findById(id: string): Promise<any | null> {
    const [result] = await this.db
      .select({
        post: posts,
        author: userProfiles,
        postUpdate: postUpdates,
      })
      .from(posts)
      .leftJoin(userProfiles, eq(posts.postByUserId, userProfiles.id))
      .leftJoin(postUpdates, eq(posts.postUpdateId, postUpdates.id))
      .where(eq(posts.id, id))
      .limit(1);
    
    if (!result) return null;

    // Get media using new pattern
    const [featuredImage, images, authorProfilePic] = await Promise.all([
      this.mediaService.getSimpleOneByResource('post', result.post.id, 'featured_image'),
      this.mediaService.getSimpleByResource('post', result.post.id, 'gallery'),
      result.author 
        ? this.mediaService.getSimpleOneByResource('user_profile', result.author.id, 'profile_pic')
        : Promise.resolve(null),
    ]);

    return {
      ...result.post,
      featuredImage,
      images,
      author: result.author ? {
        ...result.author,
        profilePic: authorProfilePic,
      } : null,
      postUpdate: result.postUpdate || null,
    };
  }

  async create(data: NewPost, postUpdateData: any): Promise<any> {
    // First create post update
    const [postUpdate] = await this.db
      .insert(postUpdates)
      .values({
        ...postUpdateData,
        postByUserId: data.postByUserId,
      })
      .returning();

    // Then create post
    const [newPost] = await this.db
      .insert(posts)
      .values({
        ...data,
        postUpdateId: postUpdate.id,
      })
      .returning();

    return {
      ...newPost,
      featuredImage: null,
      images: [],
      postUpdate,
    };
  }

  async update(id: string, data: Partial<NewPost>, postUpdateData?: any): Promise<any | null> {
    let postUpdate = null;
    
    if (postUpdateData) {
      [postUpdate] = await this.db
        .update(postUpdates)
        .set({
          ...postUpdateData,
          updatedAt: new Date(),
        })
        .where(eq(postUpdates.id, data.postUpdateId!))
        .returning();
    }

    const [updated] = await this.db
      .update(posts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
    
    if (!updated) return null;

    // Get media using new pattern
    const [featuredImage, images] = await Promise.all([
      this.mediaService.getSimpleOneByResource('post', updated.id, 'featured_image'),
      this.mediaService.getSimpleByResource('post', updated.id, 'gallery'),
    ]);

    return {
      ...updated,
      featuredImage,
      images,
      postUpdate,
    };
  }

  async list(filters: {
    query?: string;
    status?: string;
    postByUserId?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters.query) {
      // Join with postUpdates for content search
      conditions.push(
        or(
          like(postUpdates.title, `%${filters.query}%`),
          like(postUpdates.content, `%${filters.query}%`)
        )
      );
    }

    if (filters.status) {
      conditions.push(eq(posts.status, filters.status));
    }

    if (filters.postByUserId) {
      conditions.push(eq(posts.postByUserId, filters.postByUserId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countQuery = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts);
    
    if (filters.query) {
      countQuery.leftJoin(postUpdates, eq(posts.postUpdateId, postUpdates.id));
    }
    
    const [{ count }] = await countQuery.where(whereClause);

    // Get paginated results
    const results = await this.db
      .select({
        post: posts,
        author: userProfiles,
        postUpdate: postUpdates,
      })
      .from(posts)
      .leftJoin(userProfiles, eq(posts.postByUserId, userProfiles.id))
      .leftJoin(postUpdates, eq(posts.postUpdateId, postUpdates.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(posts.createdAt));

    // Get all post IDs and user IDs for batch media fetch
    const postIds = results.map(r => r.post.id);
    const userIds = results.map(r => r.author?.id).filter((id): id is string => id !== null);
    
    // Batch fetch media
    const [featuredImagesMap, galleryImagesMap, profilePicsMap] = await Promise.all([
      this.mediaService.getSimpleBatchByResources('post', postIds, 'featured_image'),
      this.mediaService.getSimpleBatchByResources('post', postIds, 'gallery'),
      this.mediaService.getSimpleBatchByResources('user_profile', userIds, 'profile_pic'),
    ]);

    return {
      data: results.map(r => ({
        ...r.post,
        featuredImage: featuredImagesMap.get(r.post.id)?.[0] || null,
        images: galleryImagesMap.get(r.post.id) || [],
        author: r.author ? {
          ...r.author,
          profilePic: profilePicsMap.get(r.author.id)?.[0] || null,
        } : null,
        postUpdate: r.postUpdate || null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async getUserPosts(userId: string, limit: number = 10, offset: number = 0) {
    const results = await this.db
      .select({
        post: posts,
        postUpdate: postUpdates,
      })
      .from(posts)
      .leftJoin(postUpdates, eq(posts.postUpdateId, postUpdates.id))
      .where(eq(posts.postByUserId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(posts.createdAt));

    // Get all post IDs for batch media fetch
    const postIds = results.map(r => r.post.id);
    
    // Batch fetch media
    const [featuredImagesMap, galleryImagesMap] = await Promise.all([
      this.mediaService.getSimpleBatchByResources('post', postIds, 'featured_image'),
      this.mediaService.getSimpleBatchByResources('post', postIds, 'gallery'),
    ]);

    return results.map(r => ({
      ...r.post,
      featuredImage: featuredImagesMap.get(r.post.id)?.[0] || null,
      images: galleryImagesMap.get(r.post.id) || [],
      postUpdate: r.postUpdate || null,
    }));
  }
}