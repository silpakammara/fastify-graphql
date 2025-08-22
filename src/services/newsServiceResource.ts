import { eq, and, or, like, desc, sql } from 'drizzle-orm';
import { news, type News, type NewNews } from '../models/news';
import { authUsers } from '../models/authUser';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { MediaServiceNew } from './mediaServiceNew';
import type { SimpleMediaField } from '../utils/mediaHelpers';

export class NewsServiceResource {
  private mediaService: MediaServiceNew;

  constructor(private db: NodePgDatabase<any>) {
    this.mediaService = new MediaServiceNew(db);
  }

  async findById(id: string): Promise<any | null> {
    const [article] = await this.db
      .select()
      .from(news)
      .where(eq(news.id, id))
      .limit(1);
    
    if (!article) return null;

    // Get feature images using new pattern
    const featureImages = await this.mediaService.getSimpleByResource('news', article.id, 'featured_image');

    return {
      ...article,
      featureImages,
    };
  }

  async create(data: NewNews): Promise<any> {
    const [newArticle] = await this.db
      .insert(news)
      .values({
        ...data,
        publishedAt: data.publishedAt || new Date(),
      })
      .returning();
    
    return {
      ...newArticle,
      featureImages: [],
    };
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

    // Get feature images using new pattern
    const featureImages = await this.mediaService.getSimpleByResource('news', updated.id, 'featured_image');

    return {
      ...updated,
      featureImages,
    };
  }

  async delete(id: string): Promise<boolean> {
    // Delete associated media first
    await this.mediaService.deleteByResource('news', id);

    // Delete news
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
      conditions.push(
        or(
          like(news.title, `%${filters.query}%`),
          like(news.content, `%${filters.query}%`),
          like(news.summary, `%${filters.query}%`)
        )
      );
    }

    // Category filter
    if (filters.category) {
      conditions.push(sql`${news.category} @> ARRAY[${filters.category}]::text[]`);
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
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(news)
      .where(whereClause);

    // Get paginated results with author info
    const results = await this.db
      .select({
        article: news,
        author: authUsers,
      })
      .from(news)
      .leftJoin(authUsers, eq(news.createdBy, authUsers.id))
      .where(whereClause)
      .limit(filters.limit || 10)
      .offset(filters.offset || 0)
      .orderBy(desc(news.publishedAt));

    // Get all news IDs for batch media fetch
    const newsIds = results.map(r => r.article.id);
    
    // Batch fetch media
    const featureImagesMap = await this.mediaService.getSimpleBatchByResources('news', newsIds, 'featured_image');

    return {
      data: results.map(r => ({
        ...r.article,
        featureImages: featureImagesMap.get(r.article.id) || [],
        author: r.author ? {
          id: r.author.id,
          name: r.author.name,
          email: r.author.email,
          avatar: r.author.avatar,
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
    
    // Get all news IDs for batch media fetch
    const newsIds = result.map(article => article.id);
    
    // Batch fetch media
    const featureImagesMap = await this.mediaService.getSimpleBatchByResources('news', newsIds, 'featured_image');

    return result.map(article => ({
      ...article,
      featureImages: featureImagesMap.get(article.id) || [],
    }));
  }

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

    // Get feature images using new pattern
    const featureImages = await this.mediaService.getSimpleByResource('news', updated.id, 'featured_image');

    return {
      ...updated,
      featureImages,
    };
  }

  async updateStatus(id: string, status: string): Promise<any | null> {
    const [updated] = await this.db
      .update(news)
      .set({
        status,
        publishedAt: status === 'published' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(news.id, id))
      .returning();
    
    if (!updated) return null;

    // Get feature images using new pattern
    const featureImages = await this.mediaService.getSimpleByResource('news', updated.id, 'featured_image');

    return {
      ...updated,
      featureImages,
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
          sql`${news.category} && ${currentArticle.category}::text[]`
        )
      )
      .limit(limit)
      .orderBy(desc(news.publishedAt));
    
    // Get all news IDs for batch media fetch
    const newsIds = result.map(article => article.id);
    
    // Batch fetch media
    const featureImagesMap = await this.mediaService.getSimpleBatchByResources('news', newsIds, 'featured_image');

    return result.map(article => ({
      ...article,
      featureImages: featureImagesMap.get(article.id) || [],
    }));
  }
}