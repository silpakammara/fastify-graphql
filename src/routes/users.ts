import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UserProfileServiceSimple } from '../services/userProfileServiceSimple';

interface QueryParams {
  query?: string;
  bloodGroup?: string;
  professions?: string;
  specializations?: string;
  yearMin?: number;
  yearMax?: number;
  cities?: string;
  states?: string;
  countries?: string;
  limit?: number;
  offset?: number;
}

const userRoutes: FastifyPluginAsync = async (fastify) => {
  const userProfileService = new UserProfileServiceSimple(fastify.db);

  // Get current user's profile
  fastify.get('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(), // User profile schema
        }),
      },
    },
  }, async (request, reply) => {
    const authUserId = request.user.userId;
    const profile = await userProfileService.findByAuthUserId(authUserId);
    
    return {
      success: true,
      data: profile,
    };
  });


  // Update user profile
  fastify.put('/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Partial(Type.Object({
        firstName: Type.String({ maxLength: 100 }),
        lastName: Type.String({ maxLength: 100 }),
        graduationYear: Type.Integer(),
        currentCity: Type.String({ maxLength: 100 }),
        latitude: Type.Number(),
        longitude: Type.Number(),
        organization: Type.String({ maxLength: 200 }),
        bloodGroup: Type.String({ maxLength: 3 }),
        phone: Type.String({ maxLength: 50 }),
        currentState: Type.String({ maxLength: 50 }),
        currentCountry: Type.String({ maxLength: 20 }),
        location: Type.String({ maxLength: 50 }),
        visibilityPreference: Type.Boolean(),
        about: Type.String(),
        socialLinks: Type.Any(),
      })),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const authUserId = request.user.userId;
    
    const profile = await userProfileService.findByAuthUserId(authUserId);
    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: 'Profile not found',
      });
    }

    const updated = await userProfileService.update(profile.id, request.body);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Delete user profile
  fastify.delete('/profile', {
  preHandler: [fastify.authenticate],
  schema: {
    response: {
      200: Type.Object({
        success: Type.Boolean(),
        message: Type.String(),
      }),
    },
  },
}, async (request, reply) => {
  const authUserId = request.user.userId;

  const profile = await userProfileService.findByAuthUserId(authUserId);
  if (!profile) {
    return reply.code(404).send({
      success: false,
      message: 'Profile not found',
    });
  }

  const deleted = await userProfileService.delete(profile.id);

  if (!deleted) {
    return reply.code(500).send({
      success: false,
      message: 'Failed to delete profile',
    });
  }

  return {
    success: true,
    message: 'Profile deleted successfully',
  };
});

  // Get user by ID
  fastify.get('/:userId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        userId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { userId } = request.params;
    const profile = await userProfileService.findById(userId);
    
    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: 'User not found',
      });
    }

    // Check visibility preference
    if (!profile.visibilityPreference && profile.userAuthId !== request.user.userId) {
      return reply.code(403).send({
        success: false,
        error: 'User profile is private',
      });
    }

    return {
      success: true,
      data: profile,
    };
  });

  // List users with filters
  fastify.get<{ Querystring: QueryParams }>('/', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        query: Type.Optional(Type.String()),
        bloodGroup: Type.Optional(Type.String()),
        professions: Type.Optional(Type.String()), // comma-separated IDs
        specializations: Type.Optional(Type.String()), // comma-separated IDs
        yearMin: Type.Optional(Type.Integer()),
        yearMax: Type.Optional(Type.Integer()),
        cities: Type.Optional(Type.String()), // comma-separated
        states: Type.Optional(Type.String()), // comma-separated
        countries: Type.Optional(Type.String()), // comma-separated
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
    const {
      query,
      bloodGroup,
      professions,
      specializations,
      yearMin,
      yearMax,
      cities,
      states,
      countries,
      limit,
      offset,
    } = request.query;

    console.log('Query params received:', {
    query,
    bloodGroup,
    professions,
    specializations,
    yearMin,
    yearMax,
    cities,
    states,
    countries,
    limit,
    offset,
  });

   const professionIds = professions?.split(',').filter(Boolean);
  const specializationIds = specializations?.split(',').filter(Boolean);
    const result = await userProfileService.list({
      query,
      bloodGroup,
      professionIds,
      specializationIds,
      yearRange: yearMin && yearMax ? { min: yearMin, max: yearMax } : undefined,
      locations: {
        cities: cities?.split(',').filter(Boolean),
        states: states?.split(',').filter(Boolean),
        countries: countries?.split(',').filter(Boolean),
      } as {
        cities?: string[];
        states?: string[];
        countries?: string[];
      },
      limit,
      offset,
      currentUserId: request.user.userId,
    });

    return {
      success: true,
      ...result,
    };
  });

  // Get doctors with specialization filters
  fastify.get('/doctors', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        specializations: Type.Optional(Type.String()), // comma-separated IDs
        cities: Type.Optional(Type.String()), // comma-separated
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
    const { specializations, cities, limit, offset } = request.query;

    const result = await userProfileService.listDoctors({
      specializationIds: specializations?.split(',').filter(Boolean),
      cities: cities?.split(',').filter(Boolean),
      limit,
      offset,
      currentUserId: request.user.userId,
    });

    return {
      success: true,
      ...result,
    };
  });
};

export default userRoutes;