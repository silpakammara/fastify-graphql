import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { FavouriteService } from '../services/favouriteService';
import { UserProfileService } from '../services/userProfileService';

const favouriteRoutes: FastifyPluginAsync = async (fastify) => {
  const favouriteService = new FavouriteService(fastify.db);
  const userProfileService = new UserProfileService(fastify.db);

  // Helper function to get user profile
  const getUserProfile = async (authUserId: string) => {
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      throw new Error('User profile not found');
    }
    return userProfile;
  };

  // Get user's favourites
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        type: Type.Optional(Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ])),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const authUserId = request.user.userId;
    const { type: likedType, limit, offset } = request.query;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return {
        success: true,
        data: [],
        total: 0,
        limit: limit || 10,
        offset: offset || 0,
      };
    }

    const result = await favouriteService.getUserFavourites(userProfile.id, {
      likedType,
      limit,
      offset,
    });
    
    return {
      success: true,
      ...result,
    };
    } catch (error) {
      fastify.log.error('Error getting user favourites:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get favourites',
      });
    }
  });

  // Get favourite stats
  fastify.get('/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            total: Type.Integer(),
            byType: Type.Array(Type.Object({
              type: Type.String(),
              count: Type.Integer(),
            })),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return {
        success: true,
        data: {
          total: 0,
          byType: [],
        },
      };
    }

    const stats = await favouriteService.getUserFavouriteStats(userProfile.id);
    
    return {
      success: true,
      data: stats,
    };
    } catch (error) {
      fastify.log.error('Error getting favourite stats:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get favourite stats',
      });
    }
  });

  // Toggle favourite (like/unlike)
  fastify.post('/toggle', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        type: Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ]),
        id: Type.String({ format: 'uuid' }), // Ensure it's a valid UUID
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          liked: Type.Boolean(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const { type, id } = request.body;
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await getUserProfile(authUserId);
      const result = await favouriteService.toggleFavourite(userProfile.id, type, id);
      
      return {
        success: true,
        liked: result.liked,
      };
    } catch (error) {
      fastify.log.error('Error toggling favourite:', error);
      
      if (error instanceof Error && error.message === 'User profile not found') {
      return reply.code(403).send({
        success: false,
        error: 'User profile required to like content',
      });
    }
      
      return reply.code(500).send({
        success: false,
        error: 'Failed to toggle favourite',
      });
    }
  });

  // Check if content is liked
  fastify.get('/check', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        type: Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ]),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          liked: Type.Boolean(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const { type, id } = request.query;
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return {
        success: true,
        liked: false,
      };
    }

    const liked = await favouriteService.checkFavourite(userProfile.id, type, id);
    
    return {
      success: true,
      liked,
    };
    } catch (error) {
      fastify.log.error('Error checking favourite:', error);
      return {
        success: true,
        liked: false, // Default to false on error
      };
    }
  });

  // Get like count for content
  fastify.get('/count', {
    schema: {
      querystring: Type.Object({
        type: Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ]),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          count: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
   try {
    console.log('Getting like count for:', request.query);
    const { type, id } = request.query;
    const count = await favouriteService.getFavouriteCount(type, id);
    
    return {
      success: true,
      count,
    };
  } catch (error) {
      fastify.log.error('Error getting favourite count:', error);
      return {
        success: true,
        count: 0, 
      };
    }
  });

  // Get users who liked content
  fastify.get('/:contentId/users', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        contentId: Type.String({ format: 'uuid' }),
      }),
      querystring: Type.Object({
        type: Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ]),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
         data: Type.Array(Type.Object({
          id: Type.String(),
          likedType: Type.String(),
          likedTypeId: Type.String(),
          createdAt: Type.String(),
          updatedAt: Type.Optional(Type.String()),
          user: Type.Union([
            Type.Object({
              id: Type.String(),
              firstName: Type.String(),
              lastName: Type.String(),
              profilePic: Type.Union([Type.String(), Type.Null()]),
              graduationYear: Type.Union([Type.Number(), Type.Null()]),
              profession: Type.Union([Type.String(), Type.Null()]),
            }),
            Type.Null()
          ])
        })),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const { contentId } = request.params;
    const { type, limit, offset } = request.query;
    
    const result = await favouriteService.getUsersWhoLiked(type, contentId, { limit, offset });
    
    return {
      success: true,
      ...result,
    };
    } catch (error) {
      fastify.log.error('Error getting users who liked:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to get users who liked content',
      });
    }
  });


  // Get user's favourites
  fastify.get('/my-favourites', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        type: Type.Optional(Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
        ])),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
          total: Type.Integer(),
          limit: Type.Integer(),
          offset: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { type: likedType, limit, offset } = request.query;
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return {
        success: true,
        data: [],
        total: 0,
        limit: limit || 10,
        offset: offset || 0,
      };
    }

    const result = await favouriteService.getUserFavourites(userProfile.id, {
      likedType,
      limit,
      offset,
    });
    
    return {
      success: true,
      ...result,
    };
  });

  // Remove favourite
  fastify.delete('/', {
    preHandler: [fastify.authenticate],
    schema: {
    querystring: Type.Object({
        type: Type.Union([
          Type.Literal('user'),
          Type.Literal('post'),
          Type.Literal('comment'),
          Type.Literal('reply'),
          Type.Literal('business'),
          Type.Literal('news'),
        ]),
        id: Type.String({ format: 'uuid' }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const { type, id } = request.query;
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await getUserProfile(authUserId);
    
    if (!userProfile) {
      return reply.code(403).send({
        success: false,
        error: 'User profile not found',
      });
    }

    const result = await favouriteService.removeFavourite(userProfile.id, type, id);
    console.log("favorite result test", userProfile.id, type, id )
      
       if (!result) {
      return reply.code(404).send({
        success: false,
        error: 'Favourite not found or already removed',
      });
    }

    return reply.code(200).send({
        success: true,
        message: 'Favourite removed successfully',
      });

    } catch (error) {
      fastify.log.error('Error removing favourite:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to remove favourite',
      });
    }
  });
};

export default favouriteRoutes;