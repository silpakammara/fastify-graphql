import { eq, and, desc, sql,inArray } from 'drizzle-orm';
import { comments, type Comment, type NewComment } from '../models/comments';
import { commentReplies, type CommentReply, type NewCommentReply } from '../models/comment_replies';
import { user } from '../models/user';
import { postUpdates } from '../models/post_updates';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { media } from '../models/media';
import { professions } from '../models/professions';
import { getProfilePics } from '../utils/userProfilepic';
import { ResourceDescriptor, UniversalMediaHelper } from './UniversalMediaHelper';

export class CommentService {
  private mediaHelper: UniversalMediaHelper;
  constructor(private db: NodePgDatabase<any>) {
    this.mediaHelper = new UniversalMediaHelper(db);
  }

  // Comments methods
  async findCommentById(id: string): Promise<Comment | null> {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    
    return comment || null;
  }

  async createComment(data: NewComment): Promise<Comment> {
    const [newComment] = await this.db
      .insert(comments)
      .values(data)
      .returning();
    
    // Update comments count on post
    await this.db
      .update(postUpdates)
      .set({
        // commentsCount: sql`${postUpdates.commentsCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, data.postUpdatesId!));
    
    return newComment!;
  }

  async updateComment(id: string, content: string): Promise<Comment | null> {
    const [updated] = await this.db
      .update(comments)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteComment(id: string): Promise<boolean> {
    // Get comment to find post ID
    const comment = await this.findCommentById(id);
    if (!comment) return false;

    // Delete comment and all its replies
    await this.db
      .delete(commentReplies)
      .where(eq(commentReplies.commentsId, id));
    
    await this.db
      .delete(comments)
      .where(eq(comments.id, id));
    
    // Update comments count on post
    // if (comment.postUpdatesId) {
    //   await this.db
    //     .update(postUpdates)
    //     .set({
    //       commentsCount: sql`GREATEST(${postUpdates.commentsCount} - 1, 0)`,
    //       updatedAt: new Date(),
    //     })
    //     .where(eq(postUpdates.id, comment.postUpdatesId));
    // }
    
    return true;
  }

  async getCommentsByPost(postId: string, filters: {
    limit?: number;
    offset?: number;
  }) {
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.postUpdatesId, postId));

      const count = countResult[0]?.count || 0;

    // Get paginated results with user info
    const results = await this.db
      .select({
        comment: comments,
        author: user,
        professions: professions,
        repliesCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM ${commentReplies} 
          WHERE ${commentReplies.commentsId} = ${comments.id}
        ), 0)`,
      })
      .from(comments)
      .leftJoin(user, eq(comments.userProfileId, user.id))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .where(eq(comments.postUpdatesId, postId))
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(comments.createdAt));

    // const userIds = [...new Set(results.map(r => r.author?.id).filter(Boolean))];
    const userIds = [...new Set(results.map(r => r.author?.id).filter((id): id is string => typeof id === 'string'))];

    const descriptors: ResourceDescriptor[] = [];
    if (userIds.length > 0) {
      descriptors.push({
        resourceType: 'user_profile',
        ids: userIds,
        tags: ['profile_pic']
      });
    }

    const mediaMaps = await this.mediaHelper.getMediaMapsForResources(descriptors);
    const profilePicUrls = new Map<string, string>();
        mediaMaps.profilePics.forEach((media, userId) => {
          profilePicUrls.set(userId, media.url);
        });

    return {
      data: results.map(r => ({
        ...r.comment,
        author: r.author ? {
          id: r.author.id,
          firstName: r.author.firstName,
          lastName: r.author.lastName,
          profilePic: profilePicUrls.get(r.author.id) || null,
          profession: r.professions?.name || null,
        } : null,
        repliesCount: r.repliesCount,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  // Comment replies methods
  async findReplyById(id: string): Promise<CommentReply | null> {
    const [reply] = await this.db
      .select()
      .from(commentReplies)
      .where(eq(commentReplies.id, id))
      .limit(1);
    
    return reply || null;
  }

async createReply(data: NewCommentReply): Promise<CommentReply> {
  try {
    // First, verify the comment exists
    const comment = await this.findCommentById(data.commentsId!);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Insert the new reply
    const [newReply] = await this.db
      .insert(commentReplies)
      .values(data)
      .returning();
    
    if (!newReply) {
      throw new Error('Failed to create reply');
    }
    return newReply;
  } catch (error) {
    console.error('Error in createReply:', error);
    throw error;
  }
  }

  async updateReply(id: string, content: string): Promise<CommentReply | null> {
    const [updated] = await this.db
      .update(commentReplies)
      .set({
        content,
        updatedAt: new Date(),
      })
      .where(eq(commentReplies.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteReply(id: string): Promise<boolean> {
    // Get reply to find comment ID
    const reply = await this.findReplyById(id);
    if (!reply) return false;

    await this.db
      .delete(commentReplies)
      .where(eq(commentReplies.id, id));
    return true;
  }

  async getRepliesByComment(commentId: string, filters: {
    limit?: number;
    offset?: number;
  }) {
    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(commentReplies)
      .where(eq(commentReplies.commentsId, commentId));

    const count = countResult[0]?.count || 0;

    // Get paginated results with user info
    const results = await this.db
      .select({
        reply: commentReplies,
        author: user,
        professions: professions,
      })
      .from(commentReplies)
      .leftJoin(user, eq(commentReplies.userProfileId, user.id))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .where(eq(commentReplies.commentsId, commentId))
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(commentReplies.createdAt));


       const userIds = [...new Set(results.map(r => r.author?.id).filter((id): id is string => typeof id === 'string'))];

      const descriptors: ResourceDescriptor[] = [];
      if (userIds.length > 0) {
      descriptors.push({
        resourceType: 'user_profile',
        ids: userIds,
        tags: ['profile_pic']
        });
      }

    const mediaMaps = await this.mediaHelper.getMediaMapsForResources(descriptors);
    const profilePicUrls = new Map<string, string>();
        mediaMaps.profilePics.forEach((media, userId) => {
          profilePicUrls.set(userId, media.url);
        });

    return {
      data: results.map(r => ({
        ...r.reply,
        author: r.author ? {
          id: r.author.id,
          firstName: r.author.firstName,
          lastName: r.author.lastName,
          profilePic: profilePicUrls.get(r.author.id) || null,
          profession: r.professions?.name || null,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  // Like/unlike methods for comments and replies
  // async updateCommentLikes(id: string, increment: boolean): Promise<Comment | null> {
  //   const [updated] = await this.db
  //     .update(comments)
  //     .set({
  //       likeCount: increment 
  //         ? sql`${comments.likeCount} + 1`
  //         : sql`GREATEST(${comments.likeCount} - 1, 0)`,
  //       updatedAt: new Date(),
  //     })
  //     .where(eq(comments.id, id))
  //     .returning();
    
  //   return updated || null;
  // }

  // async updateReplyLikes(id: string, increment: boolean): Promise<CommentReply | null> {
  //   const [updated] = await this.db
  //     .update(commentReplies)
  //     .set({
  //       likeCount: increment 
  //         ? sql`${commentReplies.likeCount} + 1`
  //         : sql`GREATEST(${commentReplies.likeCount} - 1, 0)`,
  //       updatedAt: new Date(),
  //     })
  //     .where(eq(commentReplies.id, id))
  //     .returning();
    
  //   return updated || null;
  // }
}