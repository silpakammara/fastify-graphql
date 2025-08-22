import { eq, and, or, like, inArray, sql } from 'drizzle-orm';
import { businessDetails, type BusinessDetail, type NewBusinessDetail } from '../models/business_details';
import { user } from '../models/user';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class BusinessService {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: string): Promise<BusinessDetail | null> {
    const [business] = await this.db
      .select()
      .from(businessDetails)
      .where(eq(businessDetails.id, id))
      .limit(1);
    
    return business || null;
  }

  async findByUserId(userId: string): Promise<BusinessDetail[]> {
    const businesses = await this.db
      .select()
      .from(businessDetails)
      .where(eq(businessDetails.userId, userId));
    
    return businesses;
  }

  async create(data: NewBusinessDetail): Promise<BusinessDetail> {
    const [newBusiness] = await this.db
      .insert(businessDetails)
      .values(data)
      .returning();
    
    return newBusiness!;
  }

  async update(id: string, data: Partial<NewBusinessDetail>): Promise<BusinessDetail | null> {
    const [updated] = await this.db
      .update(businessDetails)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(businessDetails.id, id))
      .returning();
    
    return updated || null;
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(businessDetails)
      .where(eq(businessDetails.id, id));
    
    return true;
  }

  async list(filters: {
    query?: string;
    category?: string;
    subCategory?: string;
    location?: string;
    isVerified?: boolean;
    userId?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    // Search query
    if (filters.query) {
      conditions.push(
        or(
          like(businessDetails.companyName, `%${filters.query}%`),
          like(businessDetails.description, `%${filters.query}%`),
          like(businessDetails.tagLine, `%${filters.query}%`),
          sql`${businessDetails.services}::text ILIKE ${'%' + filters.query + '%'}`
        )
      );
    }

    // Category filter
    if (filters.category) {
      conditions.push(eq(businessDetails.category, filters.category));
    }

    // Sub-category filter
    if (filters.subCategory) {
      conditions.push(eq(businessDetails.subCategory, filters.subCategory));
    }

    // Location filter
    if (filters.location) {
      conditions.push(
        or(
          like(businessDetails.location, `%${filters.location}%`),
          like(businessDetails.address, `%${filters.location}%`)
        )
      );
    }

    // Verified filter
    if (filters.isVerified !== undefined) {
      conditions.push(eq(businessDetails.isVerified, filters.isVerified));
    }

    // User filter
    if (filters.userId) {
      conditions.push(eq(businessDetails.userId, filters.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(businessDetails)
      .where(whereClause);

    // Get paginated results with user info
    const results = await this.db
      .select({
        business: businessDetails,
        owner: user,
      })
      .from(businessDetails)
      .leftJoin(user, eq(businessDetails.userId, user.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(businessDetails.createdAt);

    return {
      data: results.map(r => ({
        ...r.business,
        owner: r.owner ? {
          id: r.owner.id,
          firstName: r.owner.firstName,
          lastName: r.owner.lastName,
          profilePic: r.owner.profilePic,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const results = await this.db
      .select({
        category: businessDetails.category,
        count: sql<number>`count(*)::int`,
      })
      .from(businessDetails)
      .where(businessDetails.category)
      .groupBy(businessDetails.category)
      .orderBy(sql`count(*) DESC`);

    return results;
  }

  async verifyBusiness(id: string, isVerified: boolean): Promise<BusinessDetail | null> {
    const [updated] = await this.db
      .update(businessDetails)
      .set({
        isVerified,
        updatedAt: new Date(),
      })
      .where(eq(businessDetails.id, id))
      .returning();
    
    return updated || null;
  }
}