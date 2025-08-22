import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BusinessServiceSimple } from '../services/businessServiceSimple';
import { UserProfileServiceSimple } from '../services/userProfileServiceSimple';
import { BusinessDetail } from '../models/business_details';

const businessRoutes: FastifyPluginAsync = async (fastify) => {
  const businessService = new BusinessServiceSimple(fastify.db);
  const userProfileService = new UserProfileServiceSimple(fastify.db);

  // List businesses with filters
  fastify.get<{
    Querystring: {
      query?: string;
      category?: string;
      subCategory?: string;
      location?: string;
      isVerified?: boolean;
      userId?: string;
      limit?: number;
      offset?: number;
    }
  }>('/', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.Optional(Type.String()),
        category: Type.Optional(Type.String()),
        subCategory: Type.Optional(Type.String()),
        location: Type.Optional(Type.String()),
        isVerified: Type.Optional(Type.Boolean()),
        userId: Type.Optional(Type.String()),
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
    const result = await businessService.list(request.query);
    
    return {
      success: true,
      ...result,
    };
  });

  // Get business by ID
  fastify.get('/:businessId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any , reply) => {
    const { businessId } = request.params;
    const business = await businessService.findById(businessId);
    
    if (!business) {
      return reply.code(404).send({
        success: false,
        error: 'Business not found',
      });
    }

    return {
      success: true,
      data: business,
    };
  });

  // Create new business
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        companyName: Type.String({ maxLength: 1200 }),
        description: Type.Optional(Type.String()),
        category: Type.Optional(Type.String({ maxLength: 100 })),
        // logo: Type.Optional(Type.String({ maxLength: 2500 })),
        website: Type.Optional(Type.String({ maxLength: 200 })),
        foundedYear: Type.Optional(Type.Integer()),
        name: Type.String({ maxLength: 50 }),
        role: Type.String({ maxLength: 50 }),
        address: Type.Optional(Type.String()),
        email: Type.Optional(Type.String({ maxLength: 100 })),
        isVerified: Type.Boolean({ default: false }),
        teamSize: Type.Optional(Type.String({ maxLength: 50 })),
        phone: Type.Optional(Type.String({ maxLength: 15 })),
        subCategory: Type.Optional(Type.String({ maxLength: 20 })),
        whatsapp: Type.Optional(Type.String({ maxLength: 20 })),
        location: Type.Optional(Type.String({ maxLength: 50 })),
        services: Type.Optional(Type.Array(Type.String())),
        operatingHours: Type.Optional(Type.String({ maxLength: 50 })),
        certifications: Type.Optional(Type.Array(Type.String())),
        socialLinks: Type.Optional(Type.Array(Type.String())),
        // banner: Type.Optional(Type.String({ maxLength: 25 })),
        tagLine: Type.Optional(Type.String({ maxLength: 50 })),
        geolocation: Type.Optional(Type.String({ maxLength: 200 })),
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
        error: 'User profile required to create business',
      });
    }
    const body = request.body as Omit<BusinessDetail, 'userId' | 'isVerified'>;

    const business = await businessService.create({
      ...body,
      userId: userProfile.id,
      isVerified: false, // Always start as unverified
    });

    return reply.code(201).send({
      success: true,
      data: business,
    });
  });

  // Update business
  fastify.put('/:businessId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      body: Type.Partial(Type.Object({
        companyName: Type.String({ maxLength: 1200 }),
        description: Type.String(),
        category: Type.String({ maxLength: 100 }),
        // logo: Type.String({ maxLength: 2500 }),
        website: Type.String({ maxLength: 200 }),
        foundedYear: Type.Integer(),
        name: Type.String({ maxLength: 50 }),
        role: Type.String({ maxLength: 50 }),
        address: Type.String(),
        email: Type.String({ maxLength: 100 }),
        teamSize: Type.String({ maxLength: 50 }),
        phone: Type.String({ maxLength: 15 }),
        subCategory: Type.String({ maxLength: 20 }),
        whatsapp: Type.String({ maxLength: 20 }),
        location: Type.String({ maxLength: 50 }),
        services: Type.Array(Type.String()),
        operatingHours: Type.String({ maxLength: 50 }),
        certifications: Type.Array(Type.String()),
        socialLinks: Type.Optional(Type.Array(Type.String())),
        // banner: Type.String({ maxLength: 25 }),
        tagLine: Type.String({ maxLength: 50 }),
        geolocation: Type.String({ maxLength: 200 }),
      })),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { businessId } = request.params;
    const authUserId = request.user.userId;
    
    // Get business
    const business = await businessService.findById(businessId);
    if (!business) {
      return reply.code(404).send({
        success: false,
        error: 'Business not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || business.userId !== userProfile.id) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to update this business',
      });
    }

    const updated = await businessService.update(businessId, request.body);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Delete business
  fastify.delete('/:businessId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { businessId } = request.params;
    const authUserId = request.user.userId;
    
    // Get business
    const business = await businessService.findById(businessId);
    if (!business) {
      return reply.code(404).send({
        success: false,
        error: 'Business not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || business.userId !== userProfile.id) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to delete this business',
      });
    }

    await businessService.delete(businessId);
    
    return {
      success: true,
      message: 'Business deleted successfully',
    };
  });

  // Get businesses by user
  // fastify.get('/user/:userId', {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     params: Type.Object({
  //       userId: Type.String(),
  //     }),
  //     response: {
  //       200: Type.Object({
  //         success: Type.Boolean(),
  //         data: Type.Array(Type.Any()),
  //       }),
  //     },
  //   },
  // }, async (request, reply) => {
  //   const { userId } = request.params;
  //   const businesses = await businessService.findByUserId(userId);
    
  //   return {
  //     success: true,
  //     data: businesses,
  //   };
  // });

  // Get business categories
  // fastify.get('/categories/list', {
  //   preHandler: [fastify.authenticate],
  //   schema: {
  //     response: {
  //       200: Type.Object({
  //         success: Type.Boolean(),
  //         data: Type.Array(Type.Object({
  //           category: Type.String(),
  //           count: Type.Integer(),
  //         })),
  //       }),
  //     },
  //   },
  // }, async (request, reply) => {
  //   const categories = await businessService.getCategories();
    
  //   return {
  //     success: true,
  //     data: categories,
  //   };
  // });
};

export default businessRoutes;