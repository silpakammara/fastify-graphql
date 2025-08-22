import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { PostServiceDrizzleQueryOptimized } from '../services/postServiceDrizzleQueryOptimized';
import { UserProfileServiceSimple } from '../services/userProfileServiceSimple';
import { BusinessService } from '../services/businessService';

const postRoutes: FastifyPluginAsync = async (fastify) => {
  const postService = new PostServiceDrizzleQueryOptimized(fastify.db);
  const userProfileService = new UserProfileServiceSimple(fastify.db);
  const businessService = new BusinessService(fastify.db);
 
  // List posts with filters
  fastify.get<{
    Querystring: {
      userId?: string;
      businessId?: string;
      status?: string;
      featured?: boolean;
      location?: string;
      onlyMine?: boolean;
      limit?: number;
      offset?: number;
    }
  }>('/', {
    preHandler: [fastify.authenticate],
    schema: {
       querystring: Type.Object({
        userId: Type.Optional(Type.String()),
        businessId: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        featured: Type.Optional(Type.Boolean()),
        location: Type.Optional(Type.String()),
        onlyMine: Type.Optional(Type.Boolean()),
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
  }, async (request, reply) => {
    const { onlyMine, ...filters } = request.query;

    const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
    
    if (onlyMine) {
      if (userProfile) {
        filters.userId = userProfile.id;
      }
    }

    // Get the current user's profile to check likes
    const currentUserProfile = userProfile;

    fastify.log.info({ filters, currentUserId: currentUserProfile?.id }, 'Fetching posts with filters');
    
    const result = await postService.list(filters, currentUserProfile?.id);
    
    fastify.log.info({ 
      total: result.total, 
      dataLength: result.data.length,
      firstPost: result.data[0] ? {
        id: result.data[0].id,
        content: result.data[0].content,
        hasContent: !!result.data[0].content,
        contentLength: result.data[0].content?.length,
        hasUserDetails: !!result.data[0].userDetails,
        hasBusinessDetails: !!result.data[0].businessDetails,
        hasImages: !!result.data[0].images,
        likesCount: result.data[0].likesCount,
        commentsCount: result.data[0].commentsCount
      } : null
    }, 'Posts fetched successfully');
    
    return {
      success: true,
      ...result,
    };
  });

  // Debug endpoint - check posts count
  // fastify.get('/debug/count', {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     response: {
  //       200: Type.Object({
  //         success: Type.Boolean(),
  //         data: Type.Object({
  //           totalPosts: Type.Integer(),
  //           publishedPosts: Type.Integer(),
  //           draftPosts: Type.Integer(),
  //         }),
  //       }),
  //     },
  //   },
  // }, async (request, reply) => {
  //   const [totalResult] = await fastify.db
  //     .select({ count: sql<number>`count(*)::int` })
  //     .from(postUpdates);
      
  //   const [publishedResult] = await fastify.db
  //     .select({ count: sql<number>`count(*)::int` })
  //     .from(postUpdates)
  //     .where(eq(postUpdates.status, 'published'));
      
  //   const [draftResult] = await fastify.db
  //     .select({ count: sql<number>`count(*)::int` })
  //     .from(postUpdates)
  //     .where(eq(postUpdates.status, 'draft'));
    
  //   return {
  //     success: true,
  //     data: {
  //       totalPosts: totalResult.count,
  //       publishedPosts: publishedResult.count,
  //       draftPosts: draftResult.count,
  //     },
  //   };
  // });

  // Debug endpoint - create test post
  // fastify.post('/debug/create-test', {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     response: {
  //       200: Type.Object({
  //         success: Type.Boolean(),
  //         data: Type.Any(),
  //       }),
  //     },
  //   },
  // }, async (request, reply) => {
  //   const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
  //   if (!userProfile) {
  //     return reply.code(403).send({
  //       success: false,
  //       error: 'User profile required',
  //     });
  //   }

  //   const testPost = await postService.create({
  //     content: 'This is a test post created for debugging purposes. It contains some sample content to verify that posts are displaying correctly in the app.',
  //     status: 'published',
  //     featured: false,
  //     postByUserId: userProfile.id,
  //     publishedAt: new Date(),
  //   });

  //   return {
  //     success: true,
  //     data: testPost,
  //   };
  // });

  // Get post by ID
  fastify.get<{Params: { postId: string };}>('/:postId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request, reply) => {
    const { postId } = request.params;
    // const post = await postService.findById(postId);
  const currentUserProfile = await userProfileService.findByAuthUserId(request.user.userId);
  const post = await postService.findById(postId, currentUserProfile?.id);;
    
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    return {
      success: true,
      data: post,
    };
  });

  // Create new post
  fastify.post<{
    Body: {
      content: string;
      status?: string;
      featured?: boolean;
      featuredImage?: string;
      videoUrl?: string;
      images?: string[];
      backgroundTheme?: string;
      feeling?: string;
      location?: string;
      publishedAt?: string;
    };
  }>('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        content: Type.String(),
        status: Type.Optional(Type.String({ maxLength: 50 })),
        featured: Type.Optional(Type.Boolean({ default: false })),
        featuredImage: Type.Optional(Type.String({ maxLength: 25 })),
        videoUrl: Type.Optional(Type.String({ maxLength: 200 })),
        images: Type.Optional(Type.Array(Type.String())),
        backgroundTheme: Type.Optional(Type.String({ maxLength: 100 })),
        feeling: Type.Optional(Type.String({ maxLength: 20 })),
        location: Type.Optional(Type.String({ maxLength: 100 })),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request, reply) => {
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return reply.code(403).send({
        success: false,
        error: 'User profile required to create posts',
      });
    }

  // Auto fetch business by userId
  const business = await businessService.findByUserId(userProfile.id);

  // Clean body
  const cleanedBody = { ...request.body };
  Object.keys(cleanedBody).forEach(key => {
    if ((cleanedBody as Record<string, unknown>)[key] === 'string' || (cleanedBody as Record<string, unknown>)[key] === '') {
      (cleanedBody as Record<string, unknown>)[key] = undefined;
    }
  });

    const post = await postService.create({
      ...cleanedBody,
      postByUserId: userProfile.id,
      postByBusinessId: business?.[0]?.id ?? null,
      publishedAt: cleanedBody.publishedAt ? new Date(cleanedBody.publishedAt) : new Date(),
    });

    return reply.code(201).send({
      success: true,
      data: post,
    });
  });

  // Update post
  fastify.put<{ Params: { postId: string } }>('/:postId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      body: Type.Partial(Type.Object({
        content: Type.String(),
        status: Type.String({ maxLength: 50 }),
        featured: Type.Boolean(),
        featuredImage: Type.String({ maxLength: 25 }),
        videoUrl: Type.String({ maxLength: 200 }),
        images: Type.Array(Type.String()),
        backgroundTheme: Type.String({ maxLength: 100 }),
        feeling: Type.String({ maxLength: 20 }),
        location: Type.String({ maxLength: 100 }),
      })),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { postId } = request.params;
    const authUserId = request.user.userId;
    
    // Get post
    const post = await postService.findById(postId);
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || post.postByUserId !== userProfile.id) {
      // Also check if it's posted by their business
      if (post.postByBusinessId) {
        const business = await businessService.findById(post.postByBusinessId);
        if (!business || business.userId !== userProfile?.id) {
          return reply.code(403).send({
            success: false,
            error: 'Unauthorized to update this post',
          });
        }
      } else {
        return reply.code(403).send({ success: false, error: 'Unauthorized to update this post' });
    }
  }

  // Clean body before update (like POST)
  const cleanedBody = { ...request.body };
  Object.keys(cleanedBody).forEach(key => {
    if (cleanedBody[key] === 'string' || cleanedBody[key] === '') {
      cleanedBody[key] = null;
    }
  });

    const updated = await postService.update(postId, cleanedBody);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Delete post
  fastify.delete<{ Params: { postId: string } }>('/:postId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { postId } = request.params;
    const authUserId = request.user.userId;
    
    // Get post
    const post = await postService.findById(postId);
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || post.postByUserId !== userProfile.id) {
      // Also check if it's posted by their business
      if (post.postByBusinessId) {
        const business = await businessService.findById(post.postByBusinessId);
        if (!business || business.userId !== userProfile?.id) {
          return reply.code(403).send({
            success: false,
            error: 'Unauthorized to delete this post',
          });
        }
      } else {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized to delete this post',
        });
      }
    }

    await postService.delete(postId);
    
    return {
      success: true,
      message: 'Post deleted successfully',
    };
  });

  // Get posts by user
  fastify.get<{ Params: { userId: string } , Querystring: { limit?: number, offset?: number } }>('/user/:userId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        userId: Type.String(),
      }),
      querystring: Type.Object({
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
  }, async (request, reply) => {
    const { userId } = request.params;
    const { limit, offset } = request.query;
    
    const result = await postService.getUserFeed(userId, { limit, offset });
    
    return {
      success: true,
      ...result,
    };
  });

  // Get posts by business
  fastify.get<{ Params: { businessId: any }, Querystring: { limit?: number, offset?: number } }> ('/business/:businessId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      querystring: Type.Object({
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
  }, async (request, reply) => {
    const { businessId } = request.params;
    const { limit, offset } = request.query;
    
    const result = await postService.list({
      businessId,
      limit: limit || 10,
      offset: offset || 0,
    });
    
    return {
      success: true,
      ...result,
    };
  });
};

export default postRoutes;