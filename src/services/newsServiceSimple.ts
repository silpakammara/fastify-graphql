import { eq, and, or, like, desc, sql, inArray } from 'drizzle-orm';
import { news, type News, type NewNews } from '../models/news';
import { authUsers } from '../models/authUser';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { user } from '../models/user';
import { ResourceDescriptor, UniversalMediaHelper } from './UniversalMediaHelper';

export class NewsServiceSimple {
  private mediaHelper: UniversalMediaHelper;

  constructor(private db: NodePgDatabase<any>) {
    this.mediaHelper = new UniversalMediaHelper(db);
  }

  async findById(id: string): Promise<any | null> {
    const [article] = await this.db
      .select()
      .from(news)
      .where(eq(news.id, id))
      .limit(1);
    
    if (!article) return null;

    // Transform feature images
     const featureImages = await this.mediaHelper.getMediaByIds(article.featureImages || []);
     const simplifiedFeatureImages = featureImages.map(img => ({
            id: img.id,
            url: img.url,
          }));

    return {
      ...article,
      featureImages: simplifiedFeatureImages,
    };
  }

  async create(data: NewNews): Promise<any> {
  try {
    // Ensure required fields have proper defaults
    const newsData = {
      ...data,
      status: data.status || 'draft',
      featured: data.featured || false,
      category: data.category || [],
      links: data.links || [],
      featureImages: data.featureImages || [],
      // Only set publishedAt if status is 'published' or if explicitly provided
      publishedAt: data.status === 'published' 
        ? (data.publishedAt || new Date()) 
        : data.publishedAt || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [newArticle] = await this.db
      .insert(news)
      .values(newsData)
      .returning();
    
    if (!newArticle) {
      throw new Error('Failed to create news article');
    }
    // Transform feature images
    const featureImages = await this.mediaHelper.getMediaByIds( newArticle.featureImages || []);

    return {
      ...newArticle,
      featureImages: featureImages.filter(img => img !== null),
    };
  } catch (error) {
    console.error('Error in NewsService.create:', error);
    throw error;
  }
  }

  async update(id: string, data: Partial<NewNews>): Promise<any | null> {
    const [updated] = await this.db
      .update(news)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();
    
    if (!updated) return null;

    // Transform feature images
    const featureImages = await this.mediaHelper.getMediaByIds(updated.featureImages || []);

    return {
      ...updated,
      featureImages: featureImages.filter(img => img !== null),
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(news)
      .where(eq(news.id, id));
    
    return true;
  }
  
  async list(filters: {
    query?: string;
    category?: string;
    status?: string;
    featured?: boolean;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    // Search query
    if (filters.query) {
      const q = `%${filters.query}%`;
     conditions.push(sql`(${news.title} ILIKE ${q} OR ${news.content} ILIKE ${q} OR ${news.summary} ILIKE ${q})`);
    }

    // Category filter
    if (filters.category) {
     conditions.push(sql`${news.category} @> ARRAY[${filters.category}]::varchar[]`);
    }

    // Status filter
    if (filters.status) {
      conditions.push(eq(news.status, filters.status));
    }

    // Featured filter
    if (filters.featured !== undefined) {
      conditions.push(eq(news.featured, filters.featured));
    }

    // Created by filter
    if (filters.createdBy) {
      conditions.push(eq(news.createdBy, filters.createdBy));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
  const countResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(news)
      .where(whereClause);
    
    const count = countResult[0]?.count || 0;

    // Get paginated results with author info
    const results = await this.db
      .select({
        article: news,
        author: authUsers,
        userpic: user,
      })
      .from(news)
      .leftJoin(authUsers, eq(news.createdBy, authUsers.id))
      .leftJoin(user, eq(authUsers.id, user.userAuthId))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(news.publishedAt));

      
    const descriptors: ResourceDescriptor[] = [];
    const userIds = [...new Set(results.map(r => r.userpic?.id).filter((id): id is string => typeof id === 'string'))];

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

    const allFeatureImageIds = results.flatMap(r => r.article.featureImages || []);
    const allFeatureImages = await this.mediaHelper.getMediaByIds(allFeatureImageIds);
    const featureImageMap = new Map( allFeatureImages.map(img => [img.id, { id: img.id, url: img.url }]));

    return {
      data: results.map(r => ({
        ...r.article,
        featureImages: r.article.featureImages
          ? r.article.featureImages.map(id => featureImageMap.get(id)).filter(img => img !== undefined)
          : [],
        author: r.author ? {
          id: r.author.id,
          name: r.author.name,
          email: r.author.email,
          profilepic: r.userpic ? profilePicUrls.get(r.userpic.id) || null : null,
        } : null,
      })),
      total: count,
      limit: filters.limit || 10,
      offset: filters.offset || 0,
    };
  }

  async getFeaturedNews(limit: number = 5): Promise<any[]> {
    const result = await this.db
      .select()
      .from(news)
      .where(
        and(
          eq(news.featured, true),
          eq(news.status, 'published')
        )
      )
      .limit(limit)
      .orderBy(desc(news.publishedAt));
    
    // Collect all media IDs
     const allFeatureImageIds = result.flatMap(article => article.featureImages || []);
    const allFeatureImages = await this.mediaHelper.getMediaByIds(allFeatureImageIds);
    const featureImageMap = new Map(allFeatureImages.map(img => [img.id, {id:img.id, url: img.url}]));

 return result.map(article => ({
      ...article,
      featureImages: article.featureImages
        ? article.featureImages.map(id => featureImageMap.get(id)).filter(img => img !== undefined)
        : [],
    }))}
  

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const allNews = await this.db
      .select({ category: news.category })
      .from(news)
      .where(eq(news.status, 'published'));

    // Flatten and count categories
    const categoryCount = new Map<string, number>();
    
    allNews.forEach(article => {
      if (article.category) {
        article.category.forEach(cat => {
          categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
        });
      }
    });

    return Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  async toggleFeatured(id: string, featured: boolean): Promise<any | null> {
    const [updated] = await this.db
      .update(news)
      .set({
        featured,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();
    
    if (!updated) return null;

    // Transform feature images
    const featureImages = await this.mediaHelper.getMediaByIds(updated.featureImages || []);

    return {
      ...updated,
      featureImages: featureImages.filter(img => img !== null),
    };
  }

  async updateStatus(id: string, status: string): Promise<any | null> {
    const [updated] = await this.db
      .update(news)
      .set({
        status,
        publishedAt: status === 'published' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();
    
    if (!updated) return null;

    // Transform feature images
    const featureImages = await this.mediaHelper.getMediaByIds(updated.featureImages || []);

    return {
      ...updated,
      featureImages: featureImages.filter(img => img !== null),
    };
  }

  async getRelatedNews(newsId: string, limit: number = 5): Promise<any[]> {
    // Get the current news article
    const currentArticle = await this.findById(newsId);
    if (!currentArticle || !currentArticle.category?.length) {
      return [];
    }

    // Find articles with matching categories
    const result = await this.db
      .select()
      .from(news)
      .where(
        and(
          sql`${news.id} != ${newsId}`,
          eq(news.status, 'published'),
          sql`${news.category} && ARRAY[${sql.join(currentArticle.category.map((c:any) => sql`${c}`), sql`, `)}]::varchar[]`
        )
      )
      .limit(limit)
      .orderBy(desc(news.publishedAt));
  
    const allFeatureImageIds = result.flatMap(article => article.featureImages || []);
    const allFeatureImages = await this.mediaHelper.getMediaByIds(allFeatureImageIds);
    const featureImageMap = new Map(allFeatureImages.map(img => [img.id, { id: img.id, url: img.url }]));

    return result.map(article => ({
      ...article,
      featureImages: article.featureImages
        ? article.featureImages.map(id => featureImageMap.get(id)).filter(img => img !== undefined)
        : [],
    }));
  }
}