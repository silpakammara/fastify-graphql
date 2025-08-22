import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { postUpdates, type PostUpdate, type NewPostUpdate } from '../models/post_updates';
import { media } from '../models/media';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { filterValidUUIDs } from '../utils/uuidValidator';

interface MediaField {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  variants: Record<string, string> | null;
}

export interface PostWithMedia extends Omit<PostUpdate, 'featuredImage' | 'images'> {
  featuredImage: MediaField | null;
  images: MediaField[];
  postByUser?: any;
  postByBusiness?: any;
}

export class PostServiceEnhanced {
  constructor(private db: NodePgDatabase<any>) {}

  private transformMedia(mediaRecord: any): MediaField | null {
    if (!mediaRecord) return null;
    
    return {
      id: mediaRecord.id,
      url: mediaRecord.url,
      thumbnailUrl: mediaRecord.thumbnailUrl,
      variants: mediaRecord.variants || null,
    };
  }

  async findById(id: string): Promise<PostWithMedia | null> {
    // First get the post with featured image
    const result = await this.db
      .select({
        post: postUpdates,
        featuredImageMedia: media,
        postByUser: user,
        postByBusiness: businessDetails,
      })
      .from(postUpdates)
      .leftJoin(media, eq(media.id, postUpdates.featuredImage))
      .leftJoin(user, eq(user.id, postUpdates.postByUser))
      .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusiness))
      .where(eq(postUpdates.id, id))
      .limit(1);

    if (!result[0]) return null;

    const { post, featuredImageMedia, postByUser: userProfile, postByBusiness: business } = result[0];

    // If post has image array, fetch those media records
    let imageMedias: MediaField[] = [];
    if (post.images && post.images.length > 0) {
      const imageRecords = await this.db
        .select()
        .from(media)
        .where(inArray(media.id, post.images));
      
      // Create a map for ordering
      const mediaMap = new Map(imageRecords.map(m => [m.id, m]));
      
      // Return in original order
      imageMedias = post.images
        .map(id => mediaMap.get(id))
        .filter(Boolean)
        .map(m => this.transformMedia(m))
        .filter(Boolean) as MediaField[];
    }

    return {
      ...post,
      featuredImage: this.transformMedia(featuredImageMedia),
      images: imageMedias,
      postByUser: userProfile,
      postByBusiness: business,
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

    // Get posts with featured images
    const results = await this.db
      .select({
        post: postUpdates,
        featuredImageMedia: media,
        postByUser: user,
        postByBusiness: businessDetails,
      })
      .from(postUpdates)
      .leftJoin(media, eq(media.id, postUpdates.featuredImage))
      .leftJoin(user, eq(user.id, postUpdates.postByUser))
      .leftJoin(businessDetails, eq(businessDetails.id, postUpdates.postByBusiness))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(postUpdates.publishedAt));

    // Get all unique image IDs from posts
    const allImageIds = results
      .flatMap(r => r.post.images || [])
      .filter((id, index, self) => self.indexOf(id) === index);

    // Fetch all images at once
    let imageMediaMap = new Map<string, any>();
    if (allImageIds.length > 0) {
      const allImages = await this.db
        .select()
        .from(media)
        .where(inArray(media.id, allImageIds));
      
      imageMediaMap = new Map(allImages.map(m => [m.id, m]));
    }

    // Transform results
    const posts = results.map(r => {
      const { post, featuredImageMedia, postByUser: userProfile, postByBusiness: business } = r;

      // Map image IDs to media objects
      const imageMedias = (post.images || [])
        .map(id => imageMediaMap.get(id))
        .filter(Boolean)
        .map(m => this.transformMedia(m))
        .filter(Boolean) as MediaField[];

      return {
        ...post,
        featuredImage: this.transformMedia(featuredImageMedia),
        images: imageMedias,
        postByUser: userProfile,
        postByBusiness: business,
      };
    });

    return {
      data: posts,
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async create(data: NewPostUpdate): Promise<PostWithMedia> {
    const [newPost] = await this.db
      .insert(postUpdates)
      .values({
        ...data,
        publishedAt: data.publishedAt || new Date(),
      })
      .returning();
    
    // Fetch with media
    const created = await this.findById(newPost!.id);
    return created!;
  }

  async update(id: string, data: Partial<NewPostUpdate>): Promise<PostWithMedia | null> {
    const [updated] = await this.db
      .update(postUpdates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(postUpdates.id, id))
      .returning();
    
    if (!updated) return null;
    
    // Fetch with media
    return this.findById(updated.id);
  }
}