import { eq, and, or, like, sql, desc } from 'drizzle-orm';
import { userProfiles, type UserProfile, type NewUserProfile } from '../models/userProfile';
import { authUsers } from '../models/authUser';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MediaServiceNew } from './mediaServiceNew';
import type { SimpleMediaField } from '../utils/mediaHelpers';

export class UserProfileServiceResource {
  private mediaService: MediaServiceNew;

  constructor(private db: NodePgDatabase<any>) {
    this.mediaService = new MediaServiceNew(db);
  }

  async findById(id: string): Promise<any | null> {
    const [profile] = await this.db
      .select()
      .from(userProfiles)
      .leftJoin(authUsers, eq(userProfiles.authUserId, authUsers.id))
      .where(eq(userProfiles.id, id))
      .limit(1);
    
    if (!profile) return null;

    // Get media using new pattern
    const [profilePic, banner] = await Promise.all([
      this.mediaService.getSimpleOneByResource('user_profile', profile.user_profiles.id, 'profile_pic'),
      this.mediaService.getSimpleOneByResource('user_profile', profile.user_profiles.id, 'banner'),
    ]);

    return {
      ...profile.user_profiles,
      profilePic,
      banner,
      authUser: profile.auth_users ? {
        id: profile.auth_users.id,
        email: profile.auth_users.email,
        name: profile.auth_users.name,
      } : null,
    };
  }

  async findByAuthUserId(authUserId: string): Promise<any | null> {
    const [profile] = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.authUserId, authUserId))
      .limit(1);
    
    if (!profile) return null;

    // Get media using new pattern
    const [profilePic, banner] = await Promise.all([
      this.mediaService.getSimpleOneByResource('user_profile', profile.id, 'profile_pic'),
      this.mediaService.getSimpleOneByResource('user_profile', profile.id, 'banner'),
    ]);

    return {
      ...profile,
      profilePic,
      banner,
    };
  }

  async create(data: NewUserProfile): Promise<any> {
    const [newProfile] = await this.db
      .insert(userProfiles)
      .values(data)
      .returning();
    
    return {
      ...newProfile,
      profilePic: null,
      banner: null,
    };
  }

  async update(id: string, data: Partial<NewUserProfile>): Promise<any | null> {
    const [updated] = await this.db
      .update(userProfiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, id))
      .returning();
    
    if (!updated) return null;

    // Get media using new pattern
    const [profilePic, banner] = await Promise.all([
      this.mediaService.getSimpleOneByResource('user_profile', updated.id, 'profile_pic'),
      this.mediaService.getSimpleOneByResource('user_profile', updated.id, 'banner'),
    ]);

    return {
      ...updated,
      profilePic,
      banner,
    };
  }

  async list(filters: {
    query?: string;
    location?: string;
    isVerified?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters.query) {
      conditions.push(
        or(
          like(userProfiles.fullName, `%${filters.query}%`),
          like(userProfiles.username, `%${filters.query}%`),
          like(userProfiles.bio, `%${filters.query}%`)
        )
      );
    }

    if (filters.location) {
      conditions.push(like(userProfiles.location, `%${filters.location}%`));
    }

    if (filters.isVerified !== undefined) {
      conditions.push(eq(userProfiles.isVerified, filters.isVerified));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(userProfiles)
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select()
      .from(userProfiles)
      .leftJoin(authUsers, eq(userProfiles.authUserId, authUsers.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(userProfiles.createdAt));

    // Get all user IDs for batch media fetch
    const userIds = results.map(r => r.user_profiles.id);
    
    // Batch fetch media
    const [profilePicsMap, bannersMap] = await Promise.all([
      this.mediaService.getSimpleBatchByResources('user_profile', userIds, 'profile_pic'),
      this.mediaService.getSimpleBatchByResources('user_profile', userIds, 'banner'),
    ]);

    return {
      data: results.map(r => ({
        ...r.user_profiles,
        profilePic: profilePicsMap.get(r.user_profiles.id)?.[0] || null,
        banner: bannersMap.get(r.user_profiles.id)?.[0] || null,
        authUser: r.auth_users ? {
          id: r.auth_users.id,
          email: r.auth_users.email,
          name: r.auth_users.name,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }
}