import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { AnalyticsService } from '../services/analyticsService';

const analyticsRoutes: FastifyPluginAsync = async (fastify) => {
  const analyticsService = new AnalyticsService(fastify.db);

  // Get dashboard statistics
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            totalUsers: Type.Integer(),
            totalBusinesses: Type.Integer(),
            totalPosts: Type.Integer(),
            totalNews: Type.Integer(),
            recentUsers: Type.Integer(),
            activeUsers: Type.Integer(),
            verifiedBusinesses: Type.Integer(),
            featuredNews: Type.Integer(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const stats = await analyticsService.getDashboardStats();
    
    return {
      success: true,
      data: stats,
    };
  });

  // Get users by graduation year
  fastify.get('/users/by-year', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            year: Type.Integer(),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const data = await analyticsService.getUsersByGraduationYear();
    
    return {
      success: true,
      data,
    };
  });

  // Get users by profession
  fastify.get('/users/by-profession', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            professionName: Type.Union([Type.String(), Type.Null()]),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const data = await analyticsService.getUsersByProfession();
    
    return {
      success: true,
      data,
    };
  });

  // Get doctor specializations
  fastify.get('/doctors/specializations', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            specializationName: Type.Union([Type.String(), Type.Null()]),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const data = await analyticsService.getDoctorSpecializations();
    
    return {
      success: true,
      data,
    };
  });

  // Get users by country
  fastify.get('/users/by-country', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            country: Type.String(),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const data = await analyticsService.getUsersByCountry();
    
    return {
      success: true,
      data,
    };
  });

  // Get top cities
  fastify.get('/users/top-cities', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            city: Type.String(),
            state: Type.String(),
            country: Type.String(),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const data = await analyticsService.getTopCities();
    
    return {
      success: true,
      data,
    };
  });

  // Get content statistics
  fastify.get('/content/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        startDate: Type.Optional(Type.String()), // ISO date string
        endDate: Type.Optional(Type.String()), // ISO date string
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            posts: Type.Object({
              total: Type.Integer(),
              withImages: Type.Integer(),
              withVideos: Type.Integer(),
              avgLikes: Type.Integer(),
              avgComments: Type.Integer(),
            }),
            news: Type.Object({
              total: Type.Integer(),
              featured: Type.Integer(),
              byCategory: Type.Array(Type.Object({
                category: Type.String(),
                count: Type.Integer(),
              })),
            }),
            engagement: Type.Object({
              totalLikes: Type.Integer(),
              totalComments: Type.Integer(),
              mostLikedType: Type.String(),
            }),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { startDate, endDate } = request.query;
    
    const dateRange = startDate && endDate
      ? {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        }
      : undefined;

    const stats = await analyticsService.getContentStats(dateRange);
    
    return {
      success: true,
      data: stats,
    };
  });

  // Get growth trends
  fastify.get('/growth/trends', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        period: Type.Optional(Type.Union([
          Type.Literal('daily'),
          Type.Literal('weekly'),
          Type.Literal('monthly'),
        ])),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            users: Type.Array(Type.Object({
              date: Type.String(),
              count: Type.Integer(),
            })),
            businesses: Type.Array(Type.Object({
              date: Type.String(),
              count: Type.Integer(),
            })),
            posts: Type.Array(Type.Object({
              date: Type.String(),
              count: Type.Integer(),
            })),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { period = 'monthly' } = request.query;
    const trends = await analyticsService.getGrowthTrends(period);
    
    return {
      success: true,
      data: trends,
    };
  });

  // Get comprehensive analytics summary
  fastify.get('/summary', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            overview: Type.Any(),
            userDemographics: Type.Object({
              byYear: Type.Array(Type.Any()),
              byProfession: Type.Array(Type.Any()),
              byCountry: Type.Array(Type.Any()),
              topCities: Type.Array(Type.Any()),
            }),
            contentMetrics: Type.Any(),
            trends: Type.Any(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    // Get all analytics data
    const [overview, byYear, byProfession, byCountry, topCities, contentMetrics, trends] = await Promise.all([
      analyticsService.getDashboardStats(),
      analyticsService.getUsersByGraduationYear(),
      analyticsService.getUsersByProfession(),
      analyticsService.getUsersByCountry(),
      analyticsService.getTopCities(),
      analyticsService.getContentStats(),
      analyticsService.getGrowthTrends('monthly'),
    ]);

    return {
      success: true,
      data: {
        overview,
        userDemographics: {
          byYear,
          byProfession,
          byCountry,
          topCities,
        },
        contentMetrics,
        trends,
      },
    };
  });
};

export default analyticsRoutes;