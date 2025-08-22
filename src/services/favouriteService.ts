import { eq, and, sql, desc } from 'drizzle-orm';
import { favourites, type Favourite, type NewFavourite } from '../models/favourites';
import { postUpdates } from '../models/post_updates';
import { comments } from '../models/comments';
import { commentReplies } from '../models/comment_replies';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { professions } from '../models/professions';
import { user } from '../models/user';
import { media } from '../models/media';

export class FavouriteService {
  constructor(private db: NodePgDatabase<any>) {}

  async toggleFavourite(userId: string, likedType: string, likedTypeId: string): Promise<{ liked: boolean }> {
    try {
    // Check if already liked
    const [existing] = await this.db
      .select()
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      )
      .limit(1);

    if (existing) {
      // Unlike - remove favourite
      await this.db
        .delete(favourites)
        .where(eq(favourites.id, existing.id));
      
      // Update like count based on type
      await this.updateLikeCount(likedType, likedTypeId, false);
      
      return { liked: false };
    } else {
      // Like - add favourite
      await this.db
        .insert(favourites)
        .values({
          userId,
          likedType,
          likedTypeId,
        });
      
      // Update like count based on type
      await this.updateLikeCount(likedType, likedTypeId, true);
      
      return { liked: true };
      }
    } catch (error) {
      console.error('Error in toggleFavourite:', error);
      throw new Error('Failed to toggle favourite');
    }
  }

  async checkFavourite(userId: string, likedType: string, likedTypeId: string): Promise<boolean> {
    try {
    const [existing] = await this.db
      .select()
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      )
      .limit(1);

      return !!existing;
    } catch (error) {
      console.error('Error in checkFavourite:', error);
      return false;
    }
  }

  async getFavouriteCount(likedType: string, likedTypeId: string): Promise<number> {
    try {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(favourites)
      .where(
        and(
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      );

    return result?.count || 0;
    } catch (error) {
      console.error('Error in getFavouriteCount:', error);
      return 0;
    }
  }

  async getUsersWhoLiked(likedType: string, likedTypeId: string, filters: {
    limit?: number;
    offset?: number;
  }) {
  try {
    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(favourites)
      .where(
        and(
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      );

    const totalCount = countResult?.count || 0;

    // Get paginated results with user details and profile pics in single query
    const results = await this.db
      .select({
        favourite: favourites,
        user: user,
        professions: professions,
        profilePic: {
          url: media.url,
          variants: media.variants,
        }
      })
      .from(favourites)
      .leftJoin(user, eq(favourites.userId, user.id))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(media, and(
        eq(media.resourceId, user.id),
        eq(media.resourceType, 'user_profile'),
        eq(media.tag, 'profile_pic')
      ))
      .where(
        and(
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      )
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(favourites.createdAt));

    return {
      data: results.map(r => ({
        id: r.favourite.id,
        likedType: r.favourite.likedType,
        likedTypeId: r.favourite.likedTypeId,
        createdAt: r.favourite.createdAt,
        updatedAt: r.favourite.updatedAt,
        user: r.user ? {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          profilePic:r.profilePic?.url || null,
          graduationYear: r.user.graduationYear,
          profession: r.professions?.name || null,
        } : null,
      })),
      total: totalCount,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  } catch (error) {
    console.error('Error in getUsersWhoLiked:', error);
    return {
      data: [],
      total: 0,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }
}

  async getUserFavourites(userId: string, filters: {
    likedType?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
    const conditions = [eq(favourites.userId, userId)];
    
    if (filters.likedType) {
      conditions.push(eq(favourites.likedType, filters.likedType));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(favourites)
      .where(whereClause);

    const totalCount = countResult?.count || 0;
    // Get paginated results
    const results = await this.db
      .select()
      .from(favourites)
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(favourites.createdAt));

    return {
      data: results,
        total: totalCount,
        limit: filters.limit || 10,
        offset: filters.offset || 0,
      };
    } catch (error) {
      console.error('Error in getUserFavourites:', error);
      return {
        data: [],
        total: 0,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
    }
  }

  async removeFavourite(userId: string, likedType: string, likedTypeId: string): Promise<boolean> {
    try {
    const result = await this.db
      .delete(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.likedType, likedType),
          eq(favourites.likedTypeId, likedTypeId)
        )
      );

      const rowsDeleted = result.rowCount || 0;
    if (rowsDeleted === 0) {
      console.log('No favourite found to delete');
      return false;
    }
    
      // Update like count
      await this.updateLikeCount(likedType, likedTypeId, false);
    
    return true;
    } catch (error) {
      console.error('Error in removeFavourite:', error);
      throw new Error('Failed to remove favourite');
    }
  }

  private async updateLikeCount(likedType: string, likedTypeId: string, increment: boolean) {
    try {
    const updateValue = increment 
      ? sql`COALESCE(like_count, 0) + 1`
      : sql`GREATEST(COALESCE(like_count, 0) - 1, 0)`;

    switch (likedType) {
      case 'post':
        await this.db
          .update(postUpdates)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(postUpdates.id, likedTypeId));
        break;
      
      case 'comment':
        await this.db
          .update(comments)
          .set({
            // likeCount: updateValue,
            updatedAt: new Date(),
          })
          .where(eq(comments.id, likedTypeId));
        break;
      
      case 'reply':
        await this.db
          .update(commentReplies)
          .set({
            // likeCount: updateValue,
            updatedAt: new Date(),
          })
          .where(eq(commentReplies.id, likedTypeId));
        break;
      
      // For user and business types, we don't update counts on the entities
      case 'user':
      case 'business':
       case 'news': 
        // No count update needed
        break;
        
        default:
          console.warn(`Unknown likedType: ${likedType}`);
          break;
      }
    } catch (error) {
      console.error('Error updating like count:', error);
      // Don't throw here as the main operation (like/unlike) was successful
    }
  }

  async getUserFavouriteStats(userId: string): Promise<{
    total: number;
    byType: Array<{ type: string; count: number }>;
  }> {
    try {
    // Get counts by type
    const stats = await this.db
      .select({
        likedType: favourites.likedType,
        count: sql<number>`count(*)::int`,
      })
      .from(favourites)
      .where(eq(favourites.userId, userId))
      .groupBy(favourites.likedType);

    const total = stats.reduce((sum, stat) => sum + stat.count, 0);

    return {
      total,
      byType: stats.map(s => ({
        type: s.likedType,
        count: s.count,
      })),
    };
    } catch (error) {
      console.error('Error in getUserFavouriteStats:', error);
      return {
        total: 0,
        byType: [],
      };
    }
  }
}