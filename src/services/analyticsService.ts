import { sql, gte, and, eq, between, inArray, isNotNull } from 'drizzle-orm';
import { user } from '../models/user';
import { businessDetails } from '../models/business_details';
import { postUpdates } from '../models/post_updates';
import { professions } from '../models/professions';
import { specialization } from '../models/specialization';
import { countries } from '../models/countries';
import { states } from '../models/states';
import { cities } from '../models/cities';
import { authUsers } from '../models/authUser';
import { news } from '../models/news';
import { favourites } from '../models/favourites';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export class AnalyticsService {
  constructor(private db: NodePgDatabase<any>) {}

  async getDashboardStats(): Promise<{
    totalUsers: number;
    totalBusinesses: number;
    totalPosts: number;
    totalNews: number;
    recentUsers: number;
    activeUsers: number;
    verifiedBusinesses: number;
    featuredNews: number;
  }> {
    // Get total users
    const [{ totalUsers }] = await this.db
      .select({ totalUsers: sql<number>`count(*)::int` })
      .from(user);

    // Get total businesses
    const [{ totalBusinesses }] = await this.db
      .select({ totalBusinesses: sql<number>`count(*)::int` })
      .from(businessDetails);

    // Get total posts
    const [{ totalPosts }] = await this.db
      .select({ totalPosts: sql<number>`count(*)::int` })
      .from(postUpdates);

    // Get total news
    const [{ totalNews }] = await this.db
      .select({ totalNews: sql<number>`count(*)::int` })
      .from(news)
      .where(eq(news.status, 'published'));

    // Get recent users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [{ recentUsers }] = await this.db
      .select({ recentUsers: sql<number>`count(*)::int` })
      .from(user)
      .where(gte(user.createdAt, thirtyDaysAgo));

    // Get active users (logged in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const [{ activeUsers }] = await this.db
      .select({ activeUsers: sql<number>`count(*)::int` })
      .from(authUsers)
      .where(
        and(
          eq(authUsers.isActive, true),
          gte(authUsers.lastLoginAt, sevenDaysAgo)
        )
      );

    // Get verified businesses
    const [{ verifiedBusinesses }] = await this.db
      .select({ verifiedBusinesses: sql<number>`count(*)::int` })
      .from(businessDetails)
      .where(eq(businessDetails.isVerified, true));

    // Get featured news
    const [{ featuredNews }] = await this.db
      .select({ featuredNews: sql<number>`count(*)::int` })
      .from(news)
      .where(
        and(
          eq(news.status, 'published'),
          eq(news.featured, true)
        )
      );

    return {
      totalUsers,
      totalBusinesses,
      totalPosts,
      totalNews,
      recentUsers,
      activeUsers,
      verifiedBusinesses,
      featuredNews,
    };
  }

  async getUsersByGraduationYear(): Promise<Array<{
    year: number;
    count: number;
  }>> {
    const results = await this.db
      .select({
        year: user.graduationYear,
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .groupBy(user.graduationYear)
      .orderBy(user.graduationYear);

    return results;
  }

  async getUsersByProfession(): Promise<Array<{
    professionName: string | null;
    count: number;
  }>> {
    const results = await this.db
      .select({
        professionName: professions.name,
        count: sql<number>`count(distinct ${user.id})::int`,
      })
      .from(user)
      .leftJoin(professions, eq(user.professionId, professions.id))
      .groupBy(professions.name)
      .orderBy(sql`count(distinct ${user.id}) DESC`)
      .limit(10);

    return results;
  }

  async getDoctorSpecializations(): Promise<Array<{
    specializationName: string | null;
    count: number;
  }>> {
    // Get medical professions using OR conditions
    const medicalProfessions = await this.db
      .select({ id: professions.id })
      .from(professions)
      .where(
        sql`${professions.name} ILIKE '%Doctor%' OR ${professions.name} ILIKE '%Medical%' OR ${professions.name} ILIKE '%Physician%' OR ${professions.name} ILIKE '%Surgeon%'`
      );

    const medicalProfessionIds = medicalProfessions.map(p => p.id);

    if (medicalProfessionIds.length === 0) {
      return [];
    }

    const results = await this.db
      .select({
        specializationName: specialization.name,
        count: sql<number>`count(distinct ${user.id})::int`,
      })
      .from(user)
      .leftJoin(specialization, eq(user.specializationId, specialization.id))
      .where(
        and(
          inArray(user.professionId, medicalProfessionIds),
          isNotNull(user.specializationId)
        )
      )
      .groupBy(specialization.name)
      .orderBy(sql`count(distinct ${user.id}) DESC`);

    return results;
  }

  async getUsersByCountry(): Promise<Array<{
    country: string;
    count: number;
  }>> {
    const results = await this.db
      .select({
        country: user.currentCountry,
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .groupBy(user.currentCountry)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    return results;
  }

  async getTopCities(): Promise<Array<{
    city: string;
    state: string;
    country: string;
    count: number;
  }>> {
    const results = await this.db
      .select({
        city: user.currentCity,
        state: user.currentState,
        country: user.currentCountry,
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .groupBy(user.currentCity, user.currentState, user.currentCountry)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    return results;
  }

  async getContentStats(dateRange?: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    posts: {
      total: number;
      withImages: number;
      withVideos: number;
      avgLikes: number;
      avgComments: number;
    };
    news: {
      total: number;
      featured: number;
      byCategory: Array<{ category: string; count: number }>;
    };
    engagement: {
      totalLikes: number;
      totalComments: number;
      mostLikedType: string;
    };
  }> {
    const dateCondition = dateRange
      ? between(postUpdates.publishedAt, dateRange.startDate, dateRange.endDate)
      : undefined;

    // Posts stats
    const [postsStats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        withImages: sql<number>`count(case when ${postUpdates.images} is not null then 1 end)::int`,
        withVideos: sql<number>`count(case when ${postUpdates.videoUrl} is not null then 1 end)::int`,
        avgLikes: sql<number>`COALESCE(avg(${postUpdates.likeCount}), 0)::int`,
        avgComments: sql<number>`COALESCE(avg(${postUpdates.commentsCount}), 0)::int`,
      })
      .from(postUpdates)
      .where(dateCondition);

    // News stats
    const newsDateCondition = dateRange
      ? between(news.publishedAt, dateRange.startDate, dateRange.endDate)
      : undefined;

    const [newsStats] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        featured: sql<number>`count(case when ${news.featured} = true then 1 end)::int`,
      })
      .from(news)
      .where(
        and(
          eq(news.status, 'published'),
          newsDateCondition
        )
      );

    // Get news by category
    const allNews = await this.db
      .select({ category: news.category })
      .from(news)
      .where(
        and(
          eq(news.status, 'published'),
          newsDateCondition
        )
      );

    const categoryCount = new Map<string, number>();
    allNews.forEach(article => {
      if (article.category) {
        article.category.forEach(cat => {
          categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
        });
      }
    });

    const byCategory = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Engagement stats
    const [engagementStats] = await this.db
      .select({
        totalLikes: sql<number>`count(*)::int`,
      })
      .from(favourites);

    // Get most liked type
    const likesByType = await this.db
      .select({
        type: favourites.likedType,
        count: sql<number>`count(*)::int`,
      })
      .from(favourites)
      .groupBy(favourites.likedType)
      .orderBy(sql`count(*) DESC`)
      .limit(1);

    const mostLikedType = likesByType[0]?.type || 'none';

    return {
      posts: {
        total: postsStats.total,
        withImages: postsStats.withImages,
        withVideos: postsStats.withVideos,
        avgLikes: postsStats.avgLikes,
        avgComments: postsStats.avgComments,
      },
      news: {
        total: newsStats.total,
        featured: newsStats.featured,
        byCategory,
      },
      engagement: {
        totalLikes: engagementStats.totalLikes,
        totalComments: postsStats.total * postsStats.avgComments, // Approximation
        mostLikedType,
      },
    };
  }

  async getGrowthTrends(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<{
    users: Array<{ date: string; count: number }>;
    businesses: Array<{ date: string; count: number }>;
    posts: Array<{ date: string; count: number }>;
  }> {
    const dateFormat = {
      daily: 'YYYY-MM-DD',
      weekly: 'YYYY-IW',
      monthly: 'YYYY-MM',
    }[period];

    // User growth
    const userGrowth = await this.db
      .select({
        date: sql<string>`TO_CHAR(${user.createdAt}, '${sql.raw(dateFormat)}')`,
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .groupBy(sql`TO_CHAR(${user.createdAt}, '${sql.raw(dateFormat)}')`)
      .orderBy(sql`TO_CHAR(${user.createdAt}, '${sql.raw(dateFormat)}')`);

    // Business growth
    const businessGrowth = await this.db
      .select({
        date: sql<string>`TO_CHAR(${businessDetails.createdAt}, '${sql.raw(dateFormat)}')`,
        count: sql<number>`count(*)::int`,
      })
      .from(businessDetails)
      .groupBy(sql`TO_CHAR(${businessDetails.createdAt}, '${sql.raw(dateFormat)}')`)
      .orderBy(sql`TO_CHAR(${businessDetails.createdAt}, '${sql.raw(dateFormat)}')`);

    // Post growth
    const postGrowth = await this.db
      .select({
        date: sql<string>`TO_CHAR(${postUpdates.createdAt}, '${sql.raw(dateFormat)}')`,
        count: sql<number>`count(*)::int`,
      })
      .from(postUpdates)
      .groupBy(sql`TO_CHAR(${postUpdates.createdAt}, '${sql.raw(dateFormat)}')`)
      .orderBy(sql`TO_CHAR(${postUpdates.createdAt}, '${sql.raw(dateFormat)}')`);

    return {
      users: userGrowth,
      businesses: businessGrowth,
      posts: postGrowth,
    };
  }
}