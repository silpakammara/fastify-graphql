import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { ProfessionalService } from '../services/professionalService';
import { UserProfileService } from '../services/userProfileService';

const professionRoutes: FastifyPluginAsync = async (fastify) => {
  const professionalService = new ProfessionalService(fastify.db);
  const userProfileService = new UserProfileService(fastify.db);

  // Get all professions
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            userId: Type.Union([Type.String(), Type.Null()]),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
          })),
          total: Type.Integer(),
        }),
      },
    },
  }, async (request, reply) => {
    const professions = await professionalService.getAllProfessions();
    
    return {
      success: true,
      data: professions.data,
      total: professions.total,
    };
  });

  // Get professions with user count
  fastify.get('/with-stats', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            profession: Type.Object({
              id: Type.String(),
              name: Type.String(),
              userId: Type.Union([Type.String(), Type.Null()]),
              createdAt: Type.Any(),
              updatedAt: Type.Any(),
            }),
            userCount: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const result = await professionalService.getProfessionsWithUserCount();
    
    return {
      success: true,
      data: result,
    };
  });

  // Search professions
  fastify.get('/search', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query } = request.query;
    const professions = await professionalService.searchProfessions(query);
    
    return {
      success: true,
      data: professions,
    };
  });

  // Create custom profession
  fastify.post('/', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        name: Type.String({ maxLength: 100 }),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const authUserId = request.user.userId;
    
    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return reply.code(403).send({
        success: false,
        error: 'User profile required',
      });
    }

    const profession = await professionalService.createProfession({
      name: request.body.name,
      userId: userProfile.id,
    });
    
    return reply.code(201).send({
      success: true,
      data: profession,
    });
  });

  // Get all specializations
  fastify.get('/specializations', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            professionId: Type.Union([Type.String(), Type.Null()]),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const specializations = await professionalService.getAllSpecializations();
    
    return {
      success: true,
      data: specializations,
    };
  });

  // Get specializations by profession
  fastify.get('/specializations/by-profession/:professionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        professionId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { professionId } = request.params;
    const specializations = await professionalService.getSpecializationsByProfession(professionId);
    
    return {
      success: true,
      data: specializations,
    };
  });

  // Get specializations with stats
  fastify.get('/specializations/with-stats', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        professionId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            specialization: Type.Object({
              id: Type.String(),
              name: Type.String(),
              professionId: Type.Union([Type.String(), Type.Null()]),
              createdAt: Type.Any(),
              updatedAt: Type.Any(),
            }),
            profession: Type.Union([Type.Object({
              id: Type.String(),
              name: Type.String(),
            }), Type.Null()]),
            userCount: Type.Integer(),
          })),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { professionId } = request.query;
    const result = await professionalService.getSpecializationsWithUserCount(professionId);
    
    return {
      success: true,
      data: result,
    };
  });

  // Search specializations
  fastify.get('/specializations/search', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.String({ minLength: 1 }),
        professionId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Any()),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query, professionId } = request.query;
    const specializations = await professionalService.searchSpecializations(query, professionId);
    
    return {
      success: true,
      data: specializations,
    };
  });

  // Create custom specialization
  fastify.post('/specializations', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        name: Type.String({ maxLength: 100 }),
        professionId: Type.String(),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    // Verify profession exists
    const profession = await professionalService.getProfessionById(request.body.professionId);
    if (!profession) {
      return reply.code(404).send({
        success: false,
        error: 'Profession not found',
      });
    }

    const spec = await professionalService.createSpecialization({
      name: request.body.name,
      professionId: request.body.professionId,
    });
    
    return reply.code(201).send({
      success: true,
      data: spec,
    });
  });

};

export default professionRoutes;