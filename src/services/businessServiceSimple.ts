import { eq, and, or, like, sql, inArray, desc } from 'drizzle-orm';
import { businessDetails, type BusinessDetail, type NewBusinessDetail } from '../models/business_details';
import { media } from '../models/media';
import { user } from '../models/user';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getMediaById, type SimpleMediaField } from '../utils/mediaHelpers';
import { filterValidUUIDs } from '../utils/uuidValidator';
import { UniversalMediaHelper } from './UniversalMediaHelper';
import { sanitizeData } from '../utils/sanitizedData';

export interface BusinessSimple extends Pick<BusinessDetail, "id" | "userId" | "name" | "companyName" | "role" | "isVerified"> {
  logo: SimpleMediaField | null;
  banner: SimpleMediaField | null;
  owner?: any;
}

export class BusinessServiceSimple {
  private mediaHelper: UniversalMediaHelper;
  constructor(private db: NodePgDatabase<any>) {
    this.mediaHelper = new UniversalMediaHelper(db);
  }

  async findById(id: string): Promise<BusinessSimple | null> {
    const [business] = await this.db
      .select()
      .from(businessDetails)
      .where(eq(businessDetails.id, id))
      .limit(1);
    
    if (!business) return null;

    // Get owner info
    if (!business.userId) return null;
    const [ownerData] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, business.userId))
      .limit(1);

    if (!ownerData) return null;
    // Get media
    const profilepic = await getMediaById(this.db, ownerData.profilePic);
    const logo = await getMediaById(this.db, business.logo);
    const banner = await getMediaById(this.db, business.banner);

    const { createdAt, updatedAt, ...businessData } = business;

    return {
      ...businessData,
      logo,
      banner,
      owner: {
        id: ownerData?.id,
        name: `${ownerData?.firstName} ${ownerData?.lastName}`,
        profilepic: profilepic
      }
    };
  }

  async create(data: NewBusinessDetail): Promise<BusinessSimple> {
    const sanitizedData=sanitizeData(data)
    const [newBusiness] = await this.db
      .insert(businessDetails)
      .values(sanitizedData)
      .returning();
    const created = await this.findById(newBusiness!.id);
    return created!;
  }

  async update(id: string, data: Partial<NewBusinessDetail>): Promise<BusinessSimple | null> {
    const sanitizedData=sanitizeData(data)
    const [updated] = await this.db
      .update(businessDetails)
      .set({
        ...sanitizedData,
        updatedAt: new Date(),
      })
      .where(eq(businessDetails.id, id))
      .returning();
    
    if (!updated) return null;
    
    return this.findById(updated.id);
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
          like(businessDetails.companyName, `%${filters.query}%`),
          like(businessDetails.description, `%${filters.query}%`),
          like(businessDetails.tagLine, `%${filters.query}%`),
          sql`${businessDetails.services}::text ILIKE ${'%' + filters.query + '%'}`
        )
      );
    }

    if (filters.category) {
      conditions.push(eq(businessDetails.category, filters.category));
    }

    if (filters.subCategory) {
      conditions.push(eq(businessDetails.subCategory, filters.subCategory));
    }

    if (filters.location) {
      conditions.push(like(businessDetails.location, `%${filters.location}%`));
    }

    if (filters.isVerified !== undefined) {
      conditions.push(eq(businessDetails.isVerified, filters.isVerified));
    }

    if (filters.userId) {
      conditions.push(eq(businessDetails.userId, filters.userId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(businessDetails)
      .where(whereClause);
    const count = countResult[0]?.count || 0;

    // Get businesses with owner info
    const results = await this.db
      .select({
        business: businessDetails,
        owner: user,
      })
      .from(businessDetails)
      .leftJoin(user, eq(user.id, businessDetails.userId))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(businessDetails.createdAt);

  // Prepare media requests for batch fetching
  const mediaDescriptors = [];

  // Collect business IDs for logos
  const businessIds = results
    .map(result => result.business.id)
    .filter(Boolean);
  if (businessIds.length > 0) {
    mediaDescriptors.push({
      resourceType: 'business' as const,
      ids: businessIds,
      tags: ['logo', 'banner'],
    });
  }
  // Collect user IDs for profile pictures
  const userIds = results
    .map(result => result.owner?.id)
    .filter((id): id is string => id !== undefined && id !== null);

  if (userIds.length > 0) {
    mediaDescriptors.push({
      resourceType: 'user_profile' as const,
      ids: userIds,
      tags: ['profile_pic'],
    });
  }

  // Fetch all media using the batch method
  const mediaMaps = await this.mediaHelper.getMediaMapsForResources(mediaDescriptors);
    // Transform results
    const businesses = results.map(({ business, owner }) => {
    const businessLogos = mediaMaps.businessLogos.get(business.id);
    const businessBanners = mediaMaps.byResource.get(business.id)?.find(m => m.tag === 'banner');
    const userProfilePic = owner ? mediaMaps.profilePics.get(owner.id) : null;

    return {
      ...business,
      // Prioritize individual media IDs, fallback to resource-based media
      logo: businessLogos ? { id: businessLogos.id, url: businessLogos.url } : null,
      banner: businessBanners ? { id: businessBanners.id, url: businessBanners.url } : null,
      owner: owner ? {
        id: owner.id,
        firstName: owner.firstName,
        lastName: owner.lastName,
        profilePic: userProfilePic ?  userProfilePic.url : null,
      } : null,
    };
  });

    return {
      data: businesses,
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(businessDetails)
      .where(eq(businessDetails.id, id));
    
    return true;
  }

  async findByUserId(userId: string): Promise<BusinessSimple[]> {
    const results = await this.db
      .select()
      .from(businessDetails)
      .where(eq(businessDetails.userId, userId));

    // Get all media IDs
    const logoIds = results.map(r => r.logo).filter(Boolean) as string[];
    const bannerIds = results.map(r => r.banner).filter(Boolean) as string[];
    const allMediaIds = [...new Set([...logoIds, ...bannerIds])];
    const validMediaIds = filterValidUUIDs(allMediaIds);

    // Fetch all media at once
    const mediaRecords = validMediaIds.length > 0
      ? await this.db
          .select()
          .from(media)
          .where(inArray(media.id, validMediaIds))
      : [];

    // Create media map
    const mediaMap = new Map<string, SimpleMediaField>();
    mediaRecords.forEach(m => {
      if (m.id && m.url) {
        const baseUrl = m.url.replace(/\/\w+$/, '');
        mediaMap.set(m.id, {
          id: m.id,
          url: `${baseUrl}/public`
        });
      }
    });

    return results.map(business => ({
      ...business,
      logo: business.logo ? mediaMap.get(business.logo) || null : null,
      banner: business.banner ? mediaMap.get(business.banner) || null : null,
    }));
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.db
      .select({
        category: businessDetails.category,
        count: sql<number>`count(*)::int`,
      })
      .from(businessDetails)
      .where(sql`${businessDetails.category} IS NOT NULL`)
      .groupBy(businessDetails.category)
      .orderBy(desc(sql`count(*)`));

    return result as { category: string; count: number }[];
  }
}