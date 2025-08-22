import { sql, like, or, and, eq, inArray, ilike } from 'drizzle-orm';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import { postUpdates } from '../models/post_updates';
import { news } from '../models/news';
import { media } from '../models/media';
import { professions } from '../models/professions';
import { specialization } from '../models/specialization';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SimpleMediaField } from '../utils/mediaHelpers';

export class SearchServiceEnhanced {
  constructor(private db: NodePgDatabase<any>) {}

  private transformToSimpleMedia(mediaRecord: any): SimpleMediaField | null {
    if (!mediaRecord?.id || !mediaRecord?.url) return null;
    const baseUrl = mediaRecord.url.replace(/\/\w+$/, '');
    return {
      id: mediaRecord.id,
      url: `${baseUrl}/public`
    };
  }

  async searchUsers(query: string, limit: number = 10): Promise<{
    users: Array<{
      id: string;
      firstName: string;
      lastName: string;
      profilePic: string|null;
      currentCity: string;
      organization: string | null;
      profession: string | null;
      specialization: string | null;
      graduationYear: number | null;
      bloodGroup: string | null;
    }>,
      total: number;
  }> {
    const results = await this.db
      .select({
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePic: user.profilePic,
          currentCity: user.currentCity,
          organization: user.organization,
          graduationYear: user.graduationYear,
          bloodGroup: user.bloodGroup
        },
        profession: professions.name,
        specialization: specialization.name,
        media: media.url
      })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .leftJoin(media, sql`${user.profilePic}::text = ${media.id}::text`)
      .where(
        and(
          eq(user.visibilityPreference, true),
          or(
            sql`${user.firstName} ILIKE ${'%' + query + '%'}`,
            sql`${user.lastName} ILIKE ${'%' + query + '%'}`,
            sql`${user.organization} ILIKE ${'%' + query + '%'}`,
            sql`${user.currentCity} ILIKE ${'%' + query + '%'}`,
            sql`${user.graduationYear}::text ILIKE ${'%' + query + '%'}`,
            sql`${user.bloodGroup} ILIKE ${'%' + query + '%'}`,
            sql`${professions.name} ILIKE ${'%' + query + '%'}`,
            sql`${specialization.name} ILIKE ${'%' + query + '%'}`
          )
        )
      )
      .limit(limit);

    return {
      users: results.map(r => ({
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        profilePic: r.media,
        currentCity: r.user.currentCity,
        organization: r.user.organization,
        profession: r.profession,
        specialization: r.specialization,
        graduationYear: r.user.graduationYear,
        bloodGroup: r.user.bloodGroup
      })),
      total: results.length
    };
  }

  async searchBusinesses(query: string, limit: number = 10): Promise<{
    businesses: Array<{
      id: string;
      companyName: string;
      category: string | null;
      location: string | null;
      logo: string | null;
    }>;
    total: number;
  }> {
    const results = await this.db
      .select({
        id: businessDetails.id,
        companyName: businessDetails.companyName,
        category: businessDetails.category,
        location: businessDetails.location,
        logo: media.url
      })
      .from(businessDetails)
      .leftJoin(media, sql`${businessDetails.logo}::text = ${media.id}::text`)
      .where(
        or(
          sql`${businessDetails.companyName} ILIKE ${'%' + query + '%'}`,
          sql`${businessDetails.category}::text ILIKE ${'%' + query + '%'}`,
          sql`${businessDetails.name} ILIKE ${'%' + query + '%'}`
        )
      )
      .limit(limit);

    return {
      businesses: results.map(r => ({
        ...r,
        logo:r.logo
      })),
      total: results.length
    };
  }

  async searchPosts(query: string, limit: number = 10): Promise<{
    posts: Array<{
      id: string;
      content: string;
      featuredImage: string | null;
      postByUser: {
        id: string;
        firstName: string;
        lastName: string;
      } | null;
      publishedAt: Date | null;
    }>;
    postscount: number;
  }> {
    const results = await this.db
      .select({
        post: {
          id: postUpdates.id,
          content: postUpdates.content,
          featuredImage: media.url,
          publishedAt: postUpdates.publishedAt,
        },
        postByUser: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
      .from(postUpdates)
      .leftJoin(user, eq(user.id, postUpdates.postByUserId))
      .leftJoin(media, sql`${postUpdates.featuredImage}::text = ${media.id}::text`)
      .where(
        and(
          eq(postUpdates.status, 'published'),
          sql`${postUpdates.content} ILIKE ${'%' + query + '%'}`,
        )
      )
      .limit(limit)
      .orderBy(sql`${postUpdates.publishedAt} DESC`);

    return {
      posts: results.map(r => ({
        id: r.post.id,
        content: r.post.content,
        featuredImage: r.post.featuredImage,
        postByUser: r.postByUser,
        publishedAt: r.post.publishedAt,
      })),
      postscount: results.length,
    };
  }

  async searchNews(query: string, limit: number = 10): Promise<{
    articles: Array<{
      id: string;
      title: string;
      summary: string | null;
      publishedAt: Date | null;
      featured: boolean | null;
      category: Array<string> | null;
    }>;
    newscount: number;
  }> {
    const results = await this.db
      .select({
        id: news.id,
        title: news.title,
        summary: news.summary,
        publishedAt: news.publishedAt,
        featured: news.featured,
        category: news.category
      })
      .from(news)
      .where(
        and(
          eq(news.status, 'published'),
          or(
            sql`${news.title} ILIKE ${'%' + query + '%'}`,
            sql`${news.content} ILIKE ${'%' + query + '%'}`,
            sql`${news.summary} ILIKE ${'%' + query + '%'}`,
            sql`${news.category}::text ILIKE ${'%' + query + '%'}`
          )
        )
      )
      .limit(limit)
      .orderBy(sql`${news.publishedAt} DESC`);

    return { articles: results,
      newscount: results.length
     };
  }

  async globalSearch(
    query: string,
    options: {
      types?: ('users' | 'businesses' | 'posts' | 'news')[];
      limit?: number;
    } = {}
  ): Promise<{
    results: {
      users?: any[];
      businesses?: any[];
      posts?: any[];
      news?: any[];
    };
    totals: {
      users: number;
      businesses: number;
      posts: number;
      news: number;
    };
  }> {
    const searchTypes = options.types || ['users', 'businesses', 'posts', 'news'];
    const limit = options.limit || 5;
    const results: any = {};
    const totals = {
      users: 0,
      businesses: 0,
      posts: 0,
      news: 0,
    };

    // Search users
    if (searchTypes.includes('users')) {
      const userResults = await this.searchUsers(query, limit);
      results.users = userResults.users;
      totals.users = userResults.users.length;
    }

    // Search businesses
    if (searchTypes.includes('businesses')) {
      const businessResults = await this.searchBusinesses(query, limit);
      results.businesses = businessResults.businesses;
      totals.businesses = businessResults.businesses.length;
    }

    // Search posts
    if (searchTypes.includes('posts')) {
      const postResults = await this.searchPosts(query, limit);
      results.posts = postResults.posts;
      totals.posts = postResults.posts.length;
    }

    // Search news
    if (searchTypes.includes('news')) {
      const newsResults = await this.searchNews(query, limit);
      results.news = newsResults.articles;
      totals.news = newsResults.articles.length;
    }

    return { results, totals };
  }
}