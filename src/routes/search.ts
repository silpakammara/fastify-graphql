import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SearchServiceEnhanced } from '../services/searchServiceEnhanced';

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const searchService = new SearchServiceEnhanced(fastify.db);

  // Global search across all content types
  fastify.get('/all', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        types: Type.Optional(Type.String()), // comma-separated: users,businesses,posts,news
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 5 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          results: Type.Object({
            users: Type.Optional(Type.Array(Type.Any())),
            businesses: Type.Optional(Type.Array(Type.Any())),
            posts: Type.Optional(Type.Array(Type.Any())),
            news: Type.Optional(Type.Array(Type.Any())),
          }),
          totals: Type.Object({
            users: Type.Integer(),
            businesses: Type.Integer(),
            posts: Type.Integer(),
            news: Type.Integer(),
          }),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query, types: typesString, limit } = request.query;
    
    const types = typesString 
      ? typesString.split(',').filter((t:any) => ['users', 'businesses', 'posts', 'news'].includes(t)) as any
      : undefined;

    const searchResults = await searchService.globalSearch(query, { types, limit });
    
    return {
      success: true,
      ...searchResults,
    };
  });

  // Search users
  fastify.get('/users', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            firstName: Type.String(),
            lastName: Type.String(),
            profilePic: Type.Union([Type.String(), Type.Null()]),
            currentCity: Type.String(),
            organization: Type.Union([Type.String(), Type.Null()]),
            profession: Type.Union([Type.String(), Type.Null()]),
            specialization: Type.Union([Type.String(), Type.Null()]),
            graduationYear: Type.Union([Type.Integer(), Type.Null()]),
            bloodGroup: Type.Union([Type.String(), Type.Null()]),
          })),
          total: Type.Integer(),
      
        }),
        
      },
    },
  }, async (request:any, reply) => {
    const { query, limit } = request.query;
    const result = await searchService.searchUsers(query, limit);
    
    return {
      success: true,
      data: result.users,
      total: result.total
    };
  });

  // Search businesses
  fastify.get('/businesses', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            companyName: Type.String(),
            category: Type.Union([Type.String(), Type.Null()]),
            location: Type.Union([Type.String(), Type.Null()]),
            logo: Type.Union([Type.String(), Type.Null()]),
          })),
           total: Type.Integer(),
        }),
       
      },
    },
  }, async (request:any, reply) => {
    const { query, limit } = request.query;
    const result = await searchService.searchBusinesses(query, limit);
    
    return {
      success: true,
      data: result.businesses,
      total: result.total
    };
  });

  // Search posts
  fastify.get('/posts', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            content: Type.String(),
            featuredImage: Type.String(),
            postByUser: Type.Union([Type.Object({
              id: Type.String(),
              firstName: Type.String(),
              lastName: Type.String(),
            }), Type.Null()]),
            publishedAt: Type.Any(),
          })),
          postscount:Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query, limit } = request.query;
    const result = await searchService.searchPosts(query, limit);
    
    return {
      success: true,
      data: result.posts,
      postscount:result.posts.length
    };
  });

  // Search news
  fastify.get('/news', {
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            title: Type.String(),
            summary: Type.String(),
            publishedAt: Type.Any(),
            featured: Type.Union([Type.Boolean(), Type.Null()]),
            category: Type.String()
          })),
          newscount: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query, limit } = request.query;
    const result = await searchService.searchNews(query, limit);
    
    return {
      success: true,
      data: result.articles || [],
      newscount: result.newscount
    };
  });

  // Get search suggestions
  // fastify.get('/suggestions', {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     querystring: Type.Object({
  //       query: Type.String({ minLength: 1 }),
  //       type: Type.Union([
  //         Type.Literal('users'),
  //         Type.Literal('businesses'),
  //         Type.Literal('locations'),
  //         Type.Literal('professions'),
  //       ]),
  //     }),
  //     response: {
  //       200: Type.Object({
  //         success: Type.Boolean(),
  //         suggestions: Type.Array(Type.String()),
  //       }),
  //     },
  //   },
  // }, async (request, reply) => {
  //   const { query, type } = request.query;
  //   const suggestions = await searchService.getSuggestions(query, type);
    
  //   return {
  //     success: true,
  //     suggestions,
  //   };
  // });
};

export default searchRoutes;