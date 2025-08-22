import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MediaCleanupService } from '../../services/mediaCleanupService';

const adminMediaRoutes: FastifyPluginAsync = async (fastify) => {
  const cleanupService = new MediaCleanupService(fastify.db, fastify);

  // Get media usage statistics
  fastify.get(
    '/stats',
    {
      onRequest: [fastify.authenticate],
      schema: {
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              total: Type.Number(),
              byEnvironment: Type.Record(Type.String(), Type.Number()),
              byUser: Type.Record(Type.String(), Type.Number()),
              byMonth: Type.Record(Type.String(), Type.Number()),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // TODO: Add admin role check here
        // if (!request.user?.isAdmin) {
        //   return reply.code(403).send({ success: false, error: 'Admin access required' });
        // }

        const stats = await cleanupService.getUsageStats();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to get media statistics',
        });
      }
    }
  );

  // Clean up orphaned images
  fastify.post<{ Body: { dryRun?: boolean } }>(
    '/cleanup/orphaned',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: Type.Object({
          dryRun: Type.Optional(Type.Boolean({ default: true })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              found: Type.Number(),
              deleted: Type.Number(),
              errors: Type.Array(Type.String()),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // TODO: Add admin role check
        const { dryRun = true } = request.body;
        
        const result = await cleanupService.cleanupOrphanedImages(dryRun);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Cleanup failed',
        });
      }
    }
  );

  // Clean up old images
  fastify.post<{ Body: { olderThanDays: number; dryRun?: boolean } }>(
    '/cleanup/old',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: Type.Object({
          olderThanDays: Type.Number({ minimum: 1 }),
          dryRun: Type.Optional(Type.Boolean({ default: true })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              found: Type.Number(),
              deleted: Type.Number(),
              errors: Type.Array(Type.String()),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        // TODO: Add admin role check
        const { olderThanDays, dryRun = true } = request.body;
        
        const result = await cleanupService.cleanupOldImages(olderThanDays, dryRun);

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Cleanup failed',
        });
      }
    }
  );

  // List images by metadata filters
  fastify.post<{ Body: { filters: any } }>(
    '/list-by-metadata',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: Type.Object({
          filters: Type.Object({
            app: Type.Optional(Type.String()),
            environment: Type.Optional(Type.String()),
            userId: Type.Optional(Type.String()),
            uploadedBefore: Type.Optional(Type.String()),
            uploadedAfter: Type.Optional(Type.String()),
          }),
        }),
      },
    },
    async (request, reply) => {
      try {
        // TODO: Add admin role check
        const { filters } = request.body;
        
        // Convert date strings to Date objects
        if (filters.uploadedBefore) {
          filters.uploadedBefore = new Date(filters.uploadedBefore);
        }
        if (filters.uploadedAfter) {
          filters.uploadedAfter = new Date(filters.uploadedAfter);
        }

        const images = await cleanupService.listImagesByMetadata(filters);

        return reply.send({
          success: true,
          data: {
            count: images.length,
            images: images.map(img => ({
              id: img.id,
              filename: img.filename,
              uploaded: img.uploaded,
              metadata: img.meta,
              variants: img.variants,
            })),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to list images',
        });
      }
    }
  );
};

export default adminMediaRoutes;