import { sql, like, or, and, eq } from 'drizzle-orm';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import { postUpdates } from '../models/post_updates';
import { news } from '../models/news';
import { professions } from '../models/professions';
import { specialization } from '../models/specialization';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class SearchService {
  constructor(private db: NodePgDatabase<any>) {}

  async searchUsers(query: string, limit: number = 10): Promise<{
    users: Array<{
      id: string;
      firstName: string;
      lastName: string;
      profilePic: string | null;
      currentCity: string;
      organization: string | null;
      profession: string | null;
      specialization: string | null;
    }>;
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
        },
        profession: professions.name,
        specialization: specialization.name,
      })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(
        and(
          eq(user.visibilityPreference, true),
          or(
            like(user.firstName, `%${query}%`),
            like(user.lastName, `%${query}%`),
            like(user.organization, `%${query}%`),
            like(user.currentCity, `%${query}%`)
          )
        )
      )
      .limit(limit);

    return {
      users: results.map(r => ({
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        profilePic: r.user.profilePic,
        currentCity: r.user.currentCity,
        organization: r.user.organization,
        profession: r.profession,
        specialization: r.specialization,
      })),
    };
  }

  async searchBusinesses(query: string, limit: number = 10): Promise<{
    businesses: Array<{
      id: string;
      companyName: string;
      logo: string | null;
      category: string | null;
      location: string | null;
      isVerified: boolean;
    }>;
  }> {
    const results = await this.db
      .select({
        id: businessDetails.id,
        companyName: businessDetails.companyName,
        logo: businessDetails.logo,
        category: businessDetails.category,
        location: businessDetails.location,
        isVerified: businessDetails.isVerified,
      })
      .from(businessDetails)
      .where(
        or(
          like(businessDetails.companyName, `%${query}%`),
          like(businessDetails.description, `%${query}%`),
          like(businessDetails.tagLine, `%${query}%`),
          sql`${businessDetails.services}::text ILIKE ${'%' + query + '%'}`
        )
      )
      .limit(limit);

    return { businesses: results };
  }

  async searchPosts(query: string, limit: number = 10): Promise<{
    posts: Array<{
      id: string;
      content: string;
      publishedAt: Date;
      likeCount: number;
      commentsCount: number;
      authorName: string | null;
      authorPic: string | null;
    }>;
  }> {
    const results = await this.db
      .select({
        post: {
          id: postUpdates.id,
          content: postUpdates.content,
          publishedAt: postUpdates.publishedAt,
          likeCount: postUpdates.likeCount,
          commentsCount: postUpdates.commentsCount,
        },
        author: {
          firstName: user.firstName,
          lastName: user.lastName,
          profilePic: user.profilePic,
        },
      })
      .from(postUpdates)
      .leftJoin(user, eq(postUpdates.postByUserId, user.id))
      .where(like(postUpdates.content, `%${query}%`))
      .limit(limit)
      .orderBy(postUpdates.publishedAt);

    return {
      posts: results.map(r => ({
        id: r.post.id,
        content: r.post.content,
        publishedAt: r.post.publishedAt,
        likeCount: r.post.likeCount || 0,
        commentsCount: r.post.commentsCount || 0,
        authorName: r.author ? `${r.author.firstName} ${r.author.lastName}` : null,
        authorPic: r.author?.profilePic || null,
      })),
    };
  }

  async searchNews(query: string, limit: number = 10): Promise<{
    news: Array<{
      id: string;
      title: string;
      summary: string;
      publishedAt: Date;
      featured: boolean | null;
      category: string[] | null;
    }>;
  }> {
    const results = await this.db
      .select({
        id: news.id,
        title: news.title,
        summary: news.summary,
        publishedAt: news.publishedAt,
        featured: news.featured,
        category: news.category,
      })
      .from(news)
      .where(
        and(
          eq(news.status, 'published'),
          or(
            like(news.title, `%${query}%`),
            like(news.summary, `%${query}%`),
            like(news.content, `%${query}%`)
          )
        )
      )
      .limit(limit)
      .orderBy(news.publishedAt);

    return { news: results };
  }

  async globalSearch(query: string, filters?: {
    types?: ('users' | 'businesses' | 'posts' | 'news')[];
    limit?: number;
  }): Promise<{
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
    const types = filters?.types || ['users', 'businesses', 'posts', 'news'];
    const limit = filters?.limit || 5;
    const results: any = {};
    const totals = {
      users: 0,
      businesses: 0,
      posts: 0,
      news: 0,
    };

    // Search users
    if (types.includes('users')) {
      const userResults = await this.searchUsers(query, limit);
      results.users = userResults.users;
      
      // Get total count
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(
          and(
            eq(user.visibilityPreference, true),
            or(
              like(user.firstName, `%${query}%`),
              like(user.lastName, `%${query}%`),
              like(user.organization, `%${query}%`),
              like(user.currentCity, `%${query}%`)
            )
          )
        );
      totals.users = count;
    }

    // Search businesses
    if (types.includes('businesses')) {
      const businessResults = await this.searchBusinesses(query, limit);
      results.businesses = businessResults.businesses;
      
      // Get total count
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(businessDetails)
        .where(
          or(
            like(businessDetails.companyName, `%${query}%`),
            like(businessDetails.description, `%${query}%`),
            like(businessDetails.tagLine, `%${query}%`)
          )
        );
      totals.businesses = count;
    }

    // Search posts
    if (types.includes('posts')) {
      const postResults = await this.searchPosts(query, limit);
      results.posts = postResults.posts;
      
      // Get total count
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(postUpdates)
        .where(like(postUpdates.content, `%${query}%`));
      totals.posts = count;
    }

    // Search news
    if (types.includes('news')) {
      const newsResults = await this.searchNews(query, limit);
      results.news = newsResults.news;
      
      // Get total count
      const [{ count }] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(news)
        .where(
          and(
            eq(news.status, 'published'),
            or(
              like(news.title, `%${query}%`),
              like(news.summary, `%${query}%`),
              like(news.content, `%${query}%`)
            )
          )
        );
      totals.news = count;
    }

    return { results, totals };
  }

  async getSuggestions(query: string, type: 'users' | 'businesses' | 'locations' | 'professions'): Promise<string[]> {
    const suggestions: string[] = [];

    switch (type) {
      case 'users':
        const userSuggestions = await this.db
          .selectDistinct({ 
            firstName: user.firstName,
            lastName: user.lastName,
          })
          .from(user)
          .where(
            and(
              eq(user.visibilityPreference, true),
              or(
                like(user.firstName, `${query}%`),
                like(user.lastName, `${query}%`)
              )
            )
          )
          .limit(10);
        
        suggestions.push(...userSuggestions.map(u => `${u.firstName} ${u.lastName}`));
        break;

      case 'businesses':
        const businessSuggestions = await this.db
          .selectDistinct({ name: businessDetails.companyName })
          .from(businessDetails)
          .where(like(businessDetails.companyName, `${query}%`))
          .limit(10);
        
        suggestions.push(...businessSuggestions.map(b => b.name));
        break;

      case 'locations':
        const locationSuggestions = await this.db
          .selectDistinct({ city: user.currentCity })
          .from(user)
          .where(like(user.currentCity, `${query}%`))
          .limit(10);
        
        suggestions.push(...locationSuggestions.map(l => l.city));
        break;

      case 'professions':
        const professionSuggestions = await this.db
          .selectDistinct({ name: professions.name })
          .from(professions)
          .where(like(professions.name, `${query}%`))
          .limit(10);
        
        suggestions.push(...professionSuggestions.map(p => p.name));
        break;
    }

    return suggestions;
  }
}