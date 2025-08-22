import { eq, and, or, like, sql, inArray, gte, lte, ilike } from 'drizzle-orm';
import { user, type User, type NewUser } from '../models/user';
import { authUsers } from '../models/authUser';
import { specialization } from '../models/specialization';
import { professions } from '../models/professions';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { UniversalMediaHelper } from './UniversalMediaHelper';

export interface UserProfileSimple extends Omit<User, 'profilePic' | 'banner'> {
  profilePic: any;
  banner:any ;
  profession?: any;
  specialization?: any;
  authUser?: any;
}

export class UserProfileServiceSimple {
  private mediaHelper: UniversalMediaHelper;
  constructor(private db: NodePgDatabase<any>) {
    this.mediaHelper=new UniversalMediaHelper(db)
  }

  async findById(id: string): Promise<UserProfileSimple | null> {
    const [userRecord] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    
    if (!userRecord) return null;

    // Get related data if needed
    const [profileData] = await this.db
      .select({
        profession: professions,
        specialization: specialization,
      })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(eq(user.id, id))
      .limit(1);

    const mediaIds = [userRecord.profilePic, userRecord.banner].filter(Boolean) as string[];
      const mediaItems = await this.mediaHelper.getMediaByIds(mediaIds);
      const profiledata = mediaItems.find(m => m.id === userRecord.profilePic) || null
      const bannerdata = mediaItems.find(m => m.id === userRecord.banner) || null;

    return {
      ...userRecord,
      profilePic:{id:profiledata?.id,url:profiledata?.url},
      banner:{id:bannerdata?.id,url:bannerdata?.url},
      profession: profileData?.profession,
      specialization: profileData?.specialization,
    };
  }

  async findByAuthUserId(authUserId: string): Promise<UserProfileSimple | null> {
    const [userRecord] = await this.db
      .select()
      .from(user)
      .where(eq(user.userAuthId, authUserId))
      .limit(1);
    
    if (!userRecord) return null;

    // Get all related data
    const [fullData] = await this.db
      .select({
        profession: professions,
        specialization: specialization,
        authUser: authUsers,
      })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .leftJoin(authUsers, eq(authUsers.id, user.userAuthId))
      .where(eq(user.id, userRecord.id))
      .limit(1);

      const mediaIds = [userRecord.profilePic, userRecord.banner].filter(Boolean) as string[];
      const mediaItems = await this.mediaHelper.getMediaByIds(mediaIds);
      const profiledata = mediaItems.find(m => m.id === userRecord.profilePic) || null
      const bannerdata = mediaItems.find(m => m.id === userRecord.banner) || null;

    return {
      ...userRecord,
      profilePic:{id:profiledata?.id,url:profiledata?.url},
      banner:{id:bannerdata?.id,url:bannerdata?.url},
      profession: fullData?.profession,
      specialization: fullData?.specialization,
      authUser: fullData?.authUser ? {
        id: fullData.authUser.id,
        email: fullData.authUser.email,
        name: fullData.authUser.name,
        provider: fullData.authUser.provider,
      } : undefined,
    };
  }

  async create(data: NewUser): Promise<UserProfileSimple> {
    const [newProfile] = await this.db
      .insert(user)
      .values(data)
      .returning();
    
    const created = await this.findById(newProfile!.id);
    return created!;
  }

  async delete(id: string): Promise<boolean> {
    try {
      // First, get the user record to access media IDs
      const userRecord = await this.findById(id);
      if (!userRecord) {
        return false;
      }
      // Delete the user profile
      const result = await this.db
        .delete(user)
        .where(eq(user.id, id))

      const rowsDeleted = result.rowCount || 0;

      if (!result) {
        return false;
      }
      return true
    }
      catch (error) {
      console.error('Error deleting user profile:', error);
      return false;
    }
  } 

  async update(id: string, data: Partial<NewUser>): Promise<UserProfileSimple | null> {
  const sanitizedData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      value === "string" ||
      value===0||
      value === "0" ||
      value === "null" ||
      value === null ||
      value === undefined
    ) {
      sanitizedData[key] = null;
    } else {
      sanitizedData[key] = value;
    }
  }
    const [updated] = await this.db
      .update(user)
      .set({
        ...sanitizedData,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning();
    
    if (!updated) return null;
    
    return this.findById(updated.id);
  }

  async list(filters: {
    query?: string | undefined;
    bloodGroup?: string | undefined;
    professionIds?: string[] | undefined;
    specializationIds?: string[] | undefined;
    yearRange?: { min: number; max: number; } | undefined;
    locations?: {
      cities?: string[];
      states?: string[];
      countries?: string[];
    } | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    currentUserId?: string | undefined; // To check if viewing own data
  }) {
    const conditions = [];

    if (filters.query) {
      conditions.push(
        or(
          ilike(user.firstName, `%${filters.query}%`),
          ilike(user.lastName, `%${filters.query}%`),
          ilike(user.organization, `%${filters.query}%`),
          ilike(user.currentCity, `%${filters.query}%`)
        )
      );
    }

    if (filters.yearRange) {
      conditions.push(
        and(
          gte(user.graduationYear, filters.yearRange.min),
          lte(user.graduationYear, filters.yearRange.max)
        )
      );
    }

    if (filters.locations?.cities?.length) {
      conditions.push(
        or(...filters.locations.cities.map(city => ilike(user.currentCity, `%${city}%`)))
      );
    }

    if (filters.locations?.states?.length) {
  conditions.push(
    or(...filters.locations.states.map(state => ilike(user.currentState, `%${state}%`)))  
  );
}


    if (filters.locations?.countries?.length) {
  conditions.push(
    or(...filters.locations.countries.map(country => ilike(user.currentCountry, `%${country}%`)))  
  );
}

    if (filters.bloodGroup) {
      conditions.push(eq(user.bloodGroup, filters.bloodGroup));
    }

    if (filters.professionIds?.length) {
      conditions.push(inArray(user.professionId, filters.professionIds));
    }

    if (filters.specializationIds?.length) {
      conditions.push(inArray(user.specializationId, filters.specializationIds));
    }

    // No visibility filter - show all users
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(whereClause);

    const count = countResult?.[0]?.count ?? 0;

    // Get users with related data and auth user info
    const results = await this.db
      .select({
        user: user,
        profession: professions,
        specialization: specialization,
        authUser: authUsers,
      })
      .from(user)
      .innerJoin(authUsers, eq(user.userAuthId, authUsers.id))
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(user.firstName, user.lastName);


    const allMediaIds = results.reduce((ids: string[], result) => {
    if (result.user.profilePic) ids.push(result.user.profilePic);
    if (result.user.banner) ids.push(result.user.banner);
    return ids;
    }, []);


     const mediaItems = allMediaIds.length > 0 ? await this.mediaHelper.getMediaByIds(allMediaIds): [];

      const mediaMap = new Map();
  mediaItems.forEach(media => {
    if (media.id) {
      mediaMap.set(media.id, { id: media.id, url: media.url });
    }
  });
    // Helper function to mask sensitive data
    const maskEmail = (email: string) => {
      const [username, domain] = email.split('@');
      if (!username || !domain) return email;
      if (username.length <= 3) {
        return `${username[0]}***@${domain}`;
      }
      return `${username.substring(0, 3)}***@${domain}`;
    };

    const maskPhone = (phone: string | null) => {
      if (!phone) return null;
      // Keep country code and last 2 digits visible
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 4) return '***';
      return phone.substring(0, phone.length - cleaned.length + 2) + '*'.repeat(cleaned.length - 4) + cleaned.slice(-2);
    };

    // Transform results with privacy masking
    const profiles = results.map(({ user: userRecord, profession, specialization: spec, authUser }) => {
      const isOwnProfile = filters.currentUserId === userRecord.userAuthId;
      const isVisible = userRecord.visibilityPreference;

      const profilePicData = userRecord.profilePic ? mediaMap.get(userRecord.profilePic) || null : null;
      const bannerData = userRecord.banner ? mediaMap.get(userRecord.banner) || null : null;


      // Base profile data - always visible
      const profile: any = {
        id: userRecord.id,
        firstName: userRecord.firstName,
        lastName: userRecord.lastName,
        graduationYear: userRecord.graduationYear,
        currentCity: userRecord.currentCity,
        currentState: userRecord.currentState,
        currentCountry: userRecord.currentCountry,
        location: userRecord.location,
        organization: userRecord.organization,
        bloodGroup: userRecord.bloodGroup,
        about: userRecord.about,
        profilePic: profilePicData,
        banner: bannerData,
        profession,
        specialization: spec,
        visibilityPreference: userRecord.visibilityPreference,
        createdAt: userRecord.createdAt,
        updatedAt: userRecord.updatedAt,
      };

      // Add sensitive data based on visibility and ownership
      if (isOwnProfile) {
        // User viewing their own profile - show everything
        profile.email = authUser.email;
        profile.phone = userRecord.phone;
        profile.latitude = userRecord.latitude;
        profile.longitude = userRecord.longitude;
        profile.socialLinks = userRecord.socialLinks;
      } else if (isVisible) {
        // Other users viewing visible profile (visibilityPreference = true) - show contact details without masking
        profile.email = maskEmail(authUser.email);
        profile.phone = maskPhone(userRecord.phone);
        // Don't show exact coordinates for privacy
        profile.latitude = null;
        profile.longitude = null;
        profile.socialLinks = userRecord.socialLinks;
      } else {
        // Profile not visible (visibilityPreference = false) - mask sensitive data
        profile.email = maskEmail(authUser.email);
        profile.phone = maskPhone(userRecord.phone);
        profile.latitude = null;
        profile.longitude = null;
        profile.socialLinks = userRecord.socialLinks;
        // Keep about and organization visible even for private profiles
      }

      return profile;
    });

    return {
      data: profiles,
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async listDoctors(filters: {
    specializationIds?: string[];
    cities?: string[] ;
    limit?: number;
    offset?: number;
    currentUserId?: string;
  }) {
    // First, get the "Doctor" profession ID
    const [doctorProfession] = await this.db
      .select()
      .from(professions)
      .where(like(professions.name, '%Doctor%'))
      .limit(1);

    if (!doctorProfession) {
      return {
        data: [],
        total: 0,
        limit: filters.limit || 10,
        offset: filters.offset || 0,
      };
    }

    // Use the existing list method with doctor profession filter
    return this.list({
      professionIds: [doctorProfession.id],
      specializationIds: filters.specializationIds,
      locations: filters.cities ? { cities: filters.cities } : undefined,
      limit: filters.limit,
      offset: filters.offset,
      currentUserId: filters.currentUserId,
    });
  }
}