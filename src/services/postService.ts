import { eq, and, or, like, desc, sql, inArray } from 'drizzle-orm';
import { postUpdates, type PostUpdate, type NewPostUpdate } from '../models/post_updates';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class PostService {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: string): Promise<PostUpdate | null> {
    const [post] = await this.db
      .select()
      .from(postUpdates)
      .where(eq(postUpdates.id, id))
      .limit(1);
    
    return post || null;
  }

  async create(data: NewPostUpdate): Promise<PostUpdate> {
    const [newPost] = await this.db
      .insert(postUpdates)
      .values({
        ...data,
        publishedAt: data.publishedAt || new Date(),
      })
      .returning();
    
    return newPost!;
  }

  async update(id: string, data: Partial<NewPostUpdate>): Promise<PostUpdate | null> {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(postUpdates)
      .where(eq(postUpdates.id, id));
    
    return true;
  }

  async list(filters: {
    query?: string;
    userId?: string;
    businessId?: string;
    status?: string;
    featured?: boolean;
    location?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    // Search query
    if (filters.query) {
      conditions.push(
        like(postUpdates.content, `%${filters.query}%`)
      );
    }

    // User filter
    if (filters.userId) {
      conditions.push(eq(postUpdates.postByUserId, filters.userId));
    }

    // Business filter
    if (filters.businessId) {
      conditions.push(eq(postUpdates.postByBusinessId, filters.businessId));
    }

    // Status filter
    if (filters.status) {
      conditions.push(eq(postUpdates.status, filters.status));
    }

    // Featured filter
    if (filters.featured !== undefined) {
      conditions.push(eq(postUpdates.featured, filters.featured));
    }

    // Location filter
    if (filters.location) {
      conditions.push(like(postUpdates.location, `%${filters.location}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);

    // Get paginated results with user and business info
    const results = await this.db
      .select({
        post: postUpdates,
        user: user,
        business: businessDetails,
      })
      .from(postUpdates)
      .leftJoin(user, eq(postUpdates.postByUserId, user.id))
      .leftJoin(businessDetails, eq(postUpdates.postByBusinessId, businessDetails.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(postUpdates.publishedAt));

    return {
      data: results.map(r => ({
        ...r.post,
        postedByUser: r.user ? {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          profilePic: r.user.profilePic,
        } : null,
        postedByBusiness: r.business ? {
          id: r.business.id,
          companyName: r.business.companyName,
          logo: r.business.logo,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async getUserFeed(userId: string, filters: {
    limit?: number;
    offset?: number;
  }) {
    // Get posts from user and their businesses
    const userProfile = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userProfile.length) {
      return { data: [], total: 0, limit: filters.limit || 10, offset: filters.offset || 0 };
    }

    const userBusinesses = await this.db
      .select({ id: businessDetails.id })
      .from(businessDetails)
      .where(eq(businessDetails.userId, userId));

    const businessIds = userBusinesses.map(b => b.id);

    const conditions = [
      or(
        eq(postUpdates.postByUserId, userId),
        businessIds.length > 0 ? inArray(postUpdates.postByBusinessId, businessIds) : sql`false`
      )
    ];

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select({
        post: postUpdates,
        user: user,
        business: businessDetails,
      })
      .from(postUpdates)
      .leftJoin(user, eq(postUpdates.postByUserId, user.id))
      .leftJoin(businessDetails, eq(postUpdates.postByBusinessId, businessDetails.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(postUpdates.publishedAt));

    return {
      data: results.map(r => ({
        ...r.post,
        postedByUser: r.user ? {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          profilePic: r.user.profilePic,
        } : null,
        postedByBusiness: r.business ? {
          id: r.business.id,
          companyName: r.business.companyName,
          logo: r.business.logo,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async toggleFeatured(id: string, featured: boolean): Promise<PostUpdate | null> {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        featured,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    return updated || null;
  }
}