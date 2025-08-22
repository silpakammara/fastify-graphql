import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { NewsServiceSimple } from '../services/newsServiceSimple';
import { Category, Status, validCategories, validStatuses } from '../models/news';


const newsRoutes: FastifyPluginAsync = async (fastify) => {
  const newsService = new NewsServiceSimple(fastify.db);

  // List news with filters
  fastify.get('/', {
    schema: {
      querystring: Type.Object({
        query: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        featured: Type.Optional(Type.Boolean()),
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
    const result = await newsService.list(request.query);
    
    return {
      success: true,
      ...result,
    };
  });

  // Get featured news
  fastify.get('/featured', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20, default: 5 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { limit } = request.query;
    const articles = await newsService.getFeaturedNews(limit);
    
    return {
      success: true,
      data: articles,
    };
  });

  // Get news categories
  fastify.get('/categories', {
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            category: Type.String(),
            count: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const categories = await newsService.getCategories();
    
    return {
      success: true,
      data: categories,
    };
  });

  // Get news by ID
  fastify.get('/:newsId', {
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const article = await newsService.findById(newsId);
    
    if (!article) {
      return reply.code(404).send({
        success: false,
        error: 'News article not found',
      });
    }

    return {
      success: true,
      data: article,
    };
  });

  // Get related news
  fastify.get('/:newsId/related', {
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10, default: 5 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const { limit } = request.query;
    
    const related = await newsService.getRelatedNews(newsId, limit);
    
    return {
      success: true,
      data: related,
    };
  });

  // Create news article
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        title: Type.String({ maxLength: 1000 }),
        content: Type.String(),
        summary: Type.String(),
        category: Type.Optional(Type.Array(Type.String({ maxLength: 100 }))),
        status: Type.Optional(Type.String({ maxLength: 100, default: 'draft' })),
        featured: Type.Optional(Type.Boolean({ default: false })),
        links: Type.Optional(Type.Array(Type.String())),
        featureImages: Type.Optional(Type.Array(Type.String())),
        videoUrl: Type.Optional(Type.String({ maxLength: 250 })),
        publishedAt: Type.Optional(Type.String()), // ISO date string
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    try {
    const authUserId = request.user.userId;
    const { status, category } = request.body;

     if (status && !validStatuses.includes(status as Status)) {
      return reply.code(400).send({
        success: false,
        error: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }
    // Validate categories
    if (category) {
      const invalidCategories = category.filter((c:any) => !validCategories.includes(c as Category));
      if (invalidCategories.length > 0) {
        return reply.code(400).send({
          success: false,
          error: `Invalid categories: ${invalidCategories.join(', ')}. Allowed: ${validCategories.join(', ')}`,
        });
      }
    }

    
    const article = await newsService.create({
      ...request.body,
      createdBy: authUserId,
      publishedAt: request.body.publishedAt 
        ? new Date(request.body.publishedAt) 
        : (request.body.status === 'published' || (!request.body.status && request.body.status !== 'draft'))
          ? new Date() 
          : null,
    })

    return reply.code(201).send({
      success: true,
      data: article,
    });
    } catch (error) {
      fastify.log.error('Error creating news article:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create news article',
      });
    }
  });

  // Update news article
  fastify.put('/:newsId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      body: Type.Partial(Type.Object({
        title: Type.String({ maxLength: 1000 }),
        content: Type.String(),
        summary: Type.String(),
        category: Type.Array(Type.String({ maxLength: 100 })),
        status: Type.String({ maxLength: 100 }),
        featured: Type.Boolean(),
        links: Type.Array(Type.String()),
        featureImages: Type.Array(Type.String()),
        videoUrl: Type.String({ maxLength: 250 }),
      })),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const authUserId = request.user.userId;
    
    // Get article
    const article = await newsService.findById(newsId);
    if (!article) {
      return reply.code(404).send({
        success: false,
        error: 'News article not found',
      });
    }

    // Check ownership (only creator can update)
    if (article.createdBy !== authUserId) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to update this article',
      });
    }

    const updated = await newsService.update(newsId, request.body);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Delete news article
  fastify.delete('/:newsId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const authUserId = request.user.userId;
    
    // Get article
    const article = await newsService.findById(newsId);
    if (!article) {
      return reply.code(404).send({
        success: false,
        error: 'News article not found',
      });
    }

    // Check ownership
    if (article.createdBy !== authUserId) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to delete this article',
      });
    }

    await newsService.delete(newsId);
    
    return {
      success: true,
      message: 'News article deleted successfully',
    };
  });

  // Toggle featured status
  fastify.patch('/:newsId/featured', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      body: Type.Object({
        featured: Type.Boolean(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const { featured } = request.body;
    const authUserId = request.user.userId;
    
    // Get article
    const article = await newsService.findById(newsId);
    if (!article) {
      return reply.code(404).send({
        success: false,
        error: 'News article not found',
      });
    }

    // Check ownership
    if (article.createdBy !== authUserId) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to update this article',
      });
    }

    const updated = await newsService.toggleFeatured(newsId, featured);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Update article status
  fastify.patch('/:newsId/status', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        newsId: Type.String(),
      }),
      body: Type.Object({
        status: Type.String({ maxLength: 100 }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { newsId } = request.params;
    const { status } = request.body;
    const authUserId = request.user.userId;
    
    // Get article
    const article = await newsService.findById(newsId);
    if (!article) {
      return reply.code(404).send({
        success: false,
        error: 'News article not found',
      });
    }

    // Check ownership
    if (article.createdBy !== authUserId) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to update this article',
      });
    }

    const updated = await newsService.updateStatus(newsId, status);
    
    return {
      success: true,
      data: updated,
    };
  });
};

export default newsRoutes;