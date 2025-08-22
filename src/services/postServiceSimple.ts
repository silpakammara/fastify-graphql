import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { postUpdates, type PostUpdate, type NewPostUpdate } from '../models/post_updates';
import { media } from '../models/media';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import { professions } from '../models/professions';
import { favourites } from '../models/favourites';
import { comments } from '../models/comments';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { getMediaById, getMediaByIds, type SimpleMediaField } from '../utils/mediaHelpers';
import { filterValidUUIDs } from '../utils/uuidValidator';

export interface PostSimple extends Omit<PostUpdate, 'featuredImage' | 'images'> {
  featuredImage: SimpleMediaField | null;
  images: SimpleMediaField[];
  postByUser?: any;
  postByBusiness?: any;
}

export class PostServiceSimple {
  constructor(private db: NodePgDatabase<any>) {}

  async findById(id: string): Promise<PostSimple | null> {
    const [postRecord] = await this.db
      .select()
      .from(postUpdates)
      .where(eq(postUpdates.id, id))
      .limit(1);
    
    if (!postRecord) return null;

    // Get related data
    const [relatedData] = await this.db
      .select({
        postByUser: user,
        postByBusiness: businessDetails,
        profession: professions,
      })
      .from(postUpdates)
      .leftJoin(user, eq(user.id, postUpdates.postByUser))
      .leftJoin(professions, eq(professions.id, user.professionId))
      .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusiness))
      .where(eq(postUpdates.id, id))
      .limit(1);

    // Get media
    const [featuredImage, images] = await Promise.all([
      getMediaById(this.db, postRecord.featuredImage),
      getMediaByIds(this.db, postRecord.images || []),
    ]);

    return {
      ...postRecord,
      featuredImage,
      images,
      postByUser: relatedData?.postByUser ? {
        ...relatedData.postByUser,
        profession: relatedData.profession,
      } : null,
      postByBusiness: relatedData?.postByBusiness,
    };
  }

  async list(filters: {
    status?: string;
    featured?: boolean;
    postByUser?: string;
    postByBusiness?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(postUpdates.status, filters.status));
    }

    if (filters.featured !== undefined) {
      conditions.push(eq(postUpdates.featured, filters.featured));
    }

    if (filters.postByUser) {
      conditions.push(eq(postUpdates.postByUser, filters.postByUser));
    }

    if (filters.postByBusiness) {
      conditions.push(eq(postUpdates.postByBusiness, filters.postByBusiness));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(postUpdates)
      .where(whereClause);

    // Get posts with related data
    const results = await this.db
      .select({
        post: postUpdates,
        postByUser: user,
        postByBusiness: businessDetails,
        profession: professions,
      })
      .from(postUpdates)
      .leftJoin(user, eq(user.id, postUpdates.postByUser))
      .leftJoin(professions, eq(professions.id, user.professionId))
      .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusiness))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(postUpdates.publishedAt));

    // Collect all media IDs
    const featuredImageIds = results.map(r => r.post.featuredImage).filter(Boolean) as string[];
    const allImageArrayIds = results.flatMap(r => r.post.images || []);
    const allMediaIds = [...new Set([...featuredImageIds, ...allImageArrayIds])];
    const validMediaIds = filterValidUUIDs(allMediaIds);

    // Fetch all media at once
    const mediaRecords = validMediaIds.length > 0
      ? await this.db
          .select()
          .from(media)
          .where(inArray(media.id, validMediaIds))
      : [];

    // Create media map with /public variant
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

    // Transform results
    const posts = results.map(({ post, postByUser, postByBusiness, profession }) => {
      // Get featured image
      const featuredImage = post.featuredImage 
        ? mediaMap.get(post.featuredImage) || null 
        : null;

      // Get images array in order
      const images = (post.images || [])
        .map(id => mediaMap.get(id))
        .filter(Boolean) as SimpleMediaField[];

      return {
        ...post,
        featuredImage,
        images,
        postByUser: postByUser ? {
          ...postByUser,
          profession,
        } : null,
        postByBusiness,
      };
    });

    return {
      data: posts,
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async create(data: NewPostUpdate): Promise<PostSimple> {
    const [newPost] = await this.db
      .insert(postUpdates)
      .values({
        ...data,
        publishedAt: data.publishedAt || new Date(),
      })
      .returning();
    
    const created = await this.findById(newPost!.id);
    return created!;
  }

  async update(id: string, data: Partial<NewPostUpdate>): Promise<PostSimple | null> {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    if (!updated) return null;
    
    return this.findById(updated.id);
  }
}