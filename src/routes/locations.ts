import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { LocationService } from '../services/locationService';

const locationRoutes: FastifyPluginAsync = async (fastify) => {
  const locationService = new LocationService(fastify.db);

  // Get all countries
  fastify.get('/countries', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            code: Type.String(),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const countries = await locationService.getAllCountries();
    
    return {
      success: true,
      data: countries,
    };
  });

  // Get states by country code
  fastify.get('/states', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        countryCode: Type.String({ minLength: 1, maxLength: 3 }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            code: Type.String(),
            countryId: Type.String(),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
          })),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { countryCode } = request.query;
    const states = await locationService.getStatesByCountry(countryCode);
    
    return {
      success: true,
      data: states,
    };
  });

  // Get cities by state code
  fastify.get('/cities', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        stateCode: Type.String({ minLength: 1, maxLength: 3 }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            stateCode: Type.String(),
            stateId: Type.String(),
            createdAt: Type.Any(),
            updatedAt: Type.Any(),
          })),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { stateCode } = request.query;
    const cities = await locationService.getCitiesByState(stateCode);
    
    return {
      success: true,
      data: cities,
    };
  });

  // Add new city
  fastify.post('/cities', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        name: Type.String({ maxLength: 50 }),
        stateCode: Type.String({ maxLength: 3 }),
        stateId: Type.String(),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const city = await locationService.createCity(request.body);
    
    return reply.code(201).send({
      success: true,
      data: city,
    });
  });

  // Search cities
  fastify.get('/search', {
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
            city: Type.Object({
              id: Type.String(),
              name: Type.String(),
              stateCode: Type.String(),
              stateId: Type.String(),
              createdAt: Type.Any(),
              updatedAt: Type.Any(),
            }),
            state: Type.Union([Type.Object({
              id: Type.String(),
              name: Type.String(),
              code: Type.String(),
              countryId: Type.String(),
            }), Type.Null()]),
            country: Type.Union([Type.Object({
              id: Type.String(),
              name: Type.String(),
              code: Type.String(),
            }), Type.Null()]),
          })),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { query, limit } = request.query;
    const result = await locationService.searchCities(query, limit);
    
    return {
      success: true,
      data: result.data,
    };
  });

  // Get location hierarchy
  fastify.get('/hierarchy', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            countries: Type.Array(Type.Object({
              country: Type.Object({
                id: Type.String(),
                name: Type.String(),
                code: Type.String(),
                createdAt: Type.Any(),
                updatedAt: Type.Any(),
              }),
              statesCount: Type.Integer(),
              citiesCount: Type.Integer(),
            })),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const hierarchy = await locationService.getLocationHierarchy();
    
    return {
      success: true,
      data: hierarchy,
    };
  });

  // Admin endpoints for bulk import
  fastify.post('/admin/bulk-import', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        type: Type.Union([
          Type.Literal('countries'),
          Type.Literal('states'),
          Type.Literal('cities'),
        ]),
        data: Type.Array(Type.Any()),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          imported: Type.Integer(),
        }),
      },
    },
  }, async (request:any, reply) => {
    const { type, data } = request.body;
    let result:any;

    switch (type) {
      case 'countries':
        result = await locationService.bulkCreateCountries(data);
        break;
      case 'states':
        result = await locationService.bulkCreateStates(data);
        break;
      case 'cities':
        result = await locationService.bulkCreateCities(data);
        break;
    }

    return reply.code(201).send({
      success: true,
      imported: result.length,
    });
  });
};

export default locationRoutes;