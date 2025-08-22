import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { businesses, type Business, type NewBusiness } from '../models/business';
import { userProfiles } from '../models/userProfile';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MediaServiceNew } from './mediaServiceNew';
import type { SimpleMediaField } from '../utils/mediaHelpers';

export class BusinessServiceResource {
  private mediaService: MediaServiceNew;

  constructor(private db: NodePgDatabase<any>) {
    this.mediaService = new MediaServiceNew(db);
  }

  async findById(id: string): Promise<any | null> {
    const [result] = await this.db
      .select({
        business: businesses,
        owner: userProfiles,
      })
      .from(businesses)
      .leftJoin(userProfiles, eq(businesses.userId, userProfiles.id))
      .where(eq(businesses.id, id))
      .limit(1);
    
    if (!result) return null;

    // Get media using new pattern
    const [logo, banner, ownerProfilePic] = await Promise.all([
      this.mediaService.getSimpleOneByResource('business', result.business.id, 'logo'),
      this.mediaService.getSimpleOneByResource('business', result.business.id, 'banner'),
      result.owner 
        ? this.mediaService.getSimpleOneByResource('user_profile', result.owner.id, 'profile_pic')
        : Promise.resolve(null),
    ]);

    return {
      ...result.business,
      logo,
      banner,
      owner: result.owner ? {
        ...result.owner,
        profilePic: ownerProfilePic,
      } : null,
    };
  }

  async create(data: NewBusiness): Promise<any> {
    const [newBusiness] = await this.db
      .insert(businesses)
      .values(data)
      .returning();
    
    return {
      ...newBusiness,
      logo: null,
      banner: null,
    };
  }

  async update(id: string, data: Partial<NewBusiness>): Promise<any | null> {
    const [updated] = await this.db
      .update(businesses)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, id))
      .returning();
    
    if (!updated) return null;

    // Get media using new pattern
    const [logo, banner] = await Promise.all([
      this.mediaService.getSimpleOneByResource('business', updated.id, 'logo'),
      this.mediaService.getSimpleOneByResource('business', updated.id, 'banner'),
    ]);

    return {
      ...updated,
      logo,
      banner,
    };
  }

  async delete(id: string): Promise<boolean> {
    // Delete associated media first
    await this.mediaService.deleteByResource('business', id);

    // Delete business
    await this.db
      .delete(businesses)
      .where(eq(businesses.id, id));
    
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

    if (filters.query) {
      conditions.push(
        or(
          like(businesses.companyName, `%${filters.query}%`),
          like(businesses.description, `%${filters.query}%`),
          like(businesses.tagLine, `%${filters.query}%`)
        )
      );
    }

    if (filters.category) {
      conditions.push(eq(businesses.category, filters.category));
    }

    if (filters.subCategory) {
      conditions.push(eq(businesses.subCategory, filters.subCategory));
    }

    if (filters.location) {
      conditions.push(like(businesses.location, `%${filters.location}%`));
    }

    if (filters.isVerified !== undefined) {
      conditions.push(eq(businesses.isVerified, filters.isVerified));
    }

    if (filters.userId) {
      conditions.push(eq(businesses.userId, filters.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(businesses)
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select({
        business: businesses,
        owner: userProfiles,
      })
      .from(businesses)
      .leftJoin(userProfiles, eq(businesses.userId, userProfiles.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(businesses.createdAt));

    // Get all business IDs and user IDs for batch media fetch
    const businessIds = results.map(r => r.business.id);
    const userIds = results.map(r => r.owner?.id).filter((id): id is string => id !== null);
    
    // Batch fetch media
    const [logosMap, bannersMap, profilePicsMap] = await Promise.all([
      this.mediaService.getSimpleBatchByResources('business', businessIds, 'logo'),
      this.mediaService.getSimpleBatchByResources('business', businessIds, 'banner'),
      this.mediaService.getSimpleBatchByResources('user_profile', userIds, 'profile_pic'),
    ]);

    return {
      data: results.map(r => ({
        ...r.business,
        logo: logosMap.get(r.business.id)?.[0] || null,
        banner: bannersMap.get(r.business.id)?.[0] || null,
        owner: r.owner ? {
          ...r.owner,
          profilePic: profilePicsMap.get(r.owner.id)?.[0] || null,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async findByUserId(userId: string): Promise<any[]> {
    const results = await this.db
      .select()
      .from(businesses)
      .where(eq(businesses.userId, userId))
      .orderBy(desc(businesses.createdAt));

    // Get all business IDs for batch media fetch
    const businessIds = results.map(r => r.id);
    
    // Batch fetch media
    const [logosMap, bannersMap] = await Promise.all([
      this.mediaService.getSimpleBatchByResources('business', businessIds, 'logo'),
      this.mediaService.getSimpleBatchByResources('business', businessIds, 'banner'),
    ]);

    return results.map(r => ({
      ...r,
      logo: logosMap.get(r.id)?.[0] || null,
      banner: bannersMap.get(r.id)?.[0] || null,
    }));
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.db
      .select({
        category: businesses.category,
        count: sql<number>`count(*)::int`,
      })
      .from(businesses)
      .where(businesses.category)
      .groupBy(businesses.category)
      .orderBy(desc(sql`count(*)`));

    return result.filter(r => r.category !== null) as { category: string; count: number }[];
  }
}