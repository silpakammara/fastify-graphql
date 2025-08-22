import { eq, and, or, like, between, inArray, sql } from 'drizzle-orm';
import { user, type User, type NewUser } from '../models/user';
import { media } from '../models/media';
import { authUsers } from '../models/authUser';
import { specialization } from '../models/specialization';
import { professions } from '../models/professions';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Define media field type
export interface MediaField {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  variants: Record<string, string> | null;
}

// Enhanced user profile with media URLs
export interface UserProfileWithMedia extends Omit<User, 'profilePic' | 'banner'> {
  profilePic: MediaField | null;
  banner: MediaField | null;
  profession?: any;
  specialization?: any;
  authUser?: any;
}

export class UserProfileServiceEnhanced {
  constructor(private db: NodePgDatabase<any>) {}

  /**
   * Transform media reference to media object
   */
  private transformMedia(mediaRecord: any): MediaField | null {
    if (!mediaRecord) return null;
    
    return {
      id: mediaRecord.id,
      url: mediaRecord.url,
      thumbnailUrl: mediaRecord.thumbnailUrl,
      variants: mediaRecord.variants || null,
    };
  }

  async findById(id: string): Promise<UserProfileWithMedia | null> {
    const result = await this.db
      .select({
        user: user,
        profilePicMedia: media,
        bannerMedia: media,
        profession: professions,
        specialization: specialization,
      })
      .from(user)
      .leftJoin(media, eq(media.id, user.profilePic))
      .leftJoin(media as any, eq((media as any).id, user.banner))
      .leftJoin(professions, eq(professions.id, user.professionId))
      .leftJoin(specialization, eq(specialization.id, user.specializationId))
      .where(eq(user.id, id))
      .limit(1);

    if (!result[0]) return null;

    const { user: userProfile, profilePicMedia, bannerMedia, profession, specialization: spec } = result[0];
    
    return {
      ...userProfile,
      profilePic: this.transformMedia(profilePicMedia),
      banner: this.transformMedia(bannerMedia),
      profession,
      specialization: spec,
    };
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfileWithMedia | null> {
    const result = await this.db
      .select({
        user: user,
        profilePicMedia: media,
        bannerMedia: media,
        profession: professions,
        specialization: specialization,
        authUser: authUsers,
      })
      .from(user)
      .leftJoin(media, eq(media.id, user.profilePic))
      .leftJoin(media as any, eq((media as any).id, user.banner))
      .leftJoin(professions, eq(professions.id, user.professionId))
      .leftJoin(specialization, eq(specialization.id, user.specializationId))
      .leftJoin(authUsers, eq(authUsers.id, user.userAuthId))
      .where(eq(user.userAuthId, authUserId))
      .limit(1);

    if (!result[0]) return null;

    const { user: userProfile, profilePicMedia, bannerMedia, profession, specialization: spec, authUser } = result[0];
    
    return {
      ...userProfile,
      profilePic: this.transformMedia(profilePicMedia),
      banner: this.transformMedia(bannerMedia),
      profession,
      specialization: spec,
      authUser: authUser ? {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        provider: authUser.provider,
      } : undefined,
    };
  }

  async create(data: NewUser): Promise<UserProfileWithMedia> {
    const [newProfile] = await this.db
      .insert(user)
      .values(data)
      .returning();
    
    // Fetch with media
    const created = await this.findById(newProfile!.id);
    return created!;
  }

  async update(id: string, data: Partial<NewUser>): Promise<UserProfileWithMedia | null> {
    const [updated] = await this.db
      .update(user)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning();
    
    if (!updated) return null;
    
    // Fetch with media
    return this.findById(updated.id);
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(user)
      .where(eq(user.id, id));
    
    return true;
  }

  async list(filters: {
    query?: string;
    bloodGroup?: string;
    professionIds?: string[];
    specializationIds?: string[];
    yearRange?: { min: number; max: number };
    locations?: { cities?: string[]; states?: string[]; countries?: string[] };
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    // Search query
    if (filters.query) {
      conditions.push(
        or(
          like(user.firstName, `%${filters.query}%`),
          like(user.lastName, `%${filters.query}%`),
          like(user.organization, `%${filters.query}%`),
          like(user.currentCity, `%${filters.query}%`)
        )
      );
    }

    // Blood group filter
    if (filters.bloodGroup) {
      conditions.push(eq(user.bloodGroup, filters.bloodGroup));
    }

    // Profession filter
    if (filters.professionIds?.length) {
      conditions.push(inArray(user.professionId, filters.professionIds));
    }

    // Specialization filter
    if (filters.specializationIds?.length) {
      conditions.push(inArray(user.specializationId, filters.specializationIds));
    }

    // Year range filter
    if (filters.yearRange) {
      conditions.push(
        between(user.graduationYear, filters.yearRange.min, filters.yearRange.max)
      );
    }

    // Location filters
    if (filters.locations) {
      const locationConditions = [];
      if (filters.locations.cities?.length) {
        locationConditions.push(inArray(user.currentCity, filters.locations.cities));
      }
      if (filters.locations.states?.length) {
        locationConditions.push(inArray(user.currentState, filters.locations.states));
      }
      if (filters.locations.countries?.length) {
        locationConditions.push(inArray(user.currentCountry, filters.locations.countries));
      }
      if (locationConditions.length > 0) {
        conditions.push(or(...locationConditions));
      }
    }

    // Visibility filter - only show users with visibility preference true
    conditions.push(eq(user.visibilityPreference, true));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(whereClause);

    // Get paginated results with media joins
    const results = await this.db
      .select({
        user,
        profilePicMedia: media,
        bannerMedia: media,
        profession: professions,
        specialization: specialization,
      })
      .from(user)
      .leftJoin(media, eq(media.id, user.profilePic))
      .leftJoin(media as any, eq((media as any).id, user.banner))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(user.createdAt);

    return {
      data: results.map(r => ({
        ...r.user,
        profilePic: this.transformMedia(r.profilePicMedia),
        banner: this.transformMedia(r.bannerMedia),
        profession: r.profession,
        specialization: r.specialization,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async listDoctors(filters: {
    specializationIds?: string[];
    cities?: string[];
    limit?: number;
    offset?: number;
  }) {
    // Find medical profession IDs
    const medicalProfessions = await this.db
      .select()
      .from(professions)
      .where(
        or(
          like(professions.name, '%Doctor%'),
          like(professions.name, '%Medical%'),
          like(professions.name, '%Physician%'),
          like(professions.name, '%Surgeon%')
        )
      );

    const medicalProfessionIds = medicalProfessions.map(p => p.id);

    if (medicalProfessionIds.length === 0) {
      return { data: [], total: 0, limit: filters.limit || 10, offset: filters.offset || 0 };
    }

    const conditions = [
      inArray(user.professionId, medicalProfessionIds),
      eq(user.visibilityPreference, true),
    ];

    if (filters.specializationIds?.length) {
      conditions.push(inArray(user.specializationId, filters.specializationIds));
    }

    if (filters.cities?.length) {
      conditions.push(inArray(user.currentCity, filters.cities));
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .where(whereClause);

    // Get paginated results with media
    const results = await this.db
      .select({
        user,
        profilePicMedia: media,
        bannerMedia: media,
        profession: professions,
        specialization: specialization,
      })
      .from(user)
      .leftJoin(media, eq(media.id, user.profilePic))
      .leftJoin(media as any, eq((media as any).id, user.banner))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(specialization.id, user.specializationId))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(user.createdAt);

    return {
      data: results.map(r => ({
        ...r.user,
        profilePic: this.transformMedia(r.profilePicMedia),
        banner: this.transformMedia(r.bannerMedia),
        profession: r.profession,
        specialization: r.specialization,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }
}