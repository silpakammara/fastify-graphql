import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { BusinessServiceSimple } from '../services/businessServiceSimple';
import { MediaServiceNew } from '../services/mediaServiceNew';
import multipart from '@fastify/multipart';
import { eq } from 'drizzle-orm';
import { user } from '../models/user';
import { UniversalImageUploadHelper } from '../services/universalMediaUploader';

const businessMediaRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  const businessService = new BusinessServiceSimple(fastify.db);
  const mediaService = new MediaServiceNew(fastify.db);
  const uploadHelper = new UniversalImageUploadHelper(fastify);

  // Helper to get actual user ID
  const getActualUserId = async (authUserId: string) => {
    const [userRecord] = await fastify.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.userAuthId, authUserId))
      .limit(1);
    
    if (!userRecord) throw new Error('User not found');
    return userRecord.id;
  };

  // Upload business logo
  fastify.post<{ Params: { businessId: string } }>('/:businessId/logo', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            logo: Type.Object({
              id: Type.String(),
              url: Type.String(),
              thumbnailUrl: Type.Optional(Type.String()),
            }),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      // Get user info and verify business ownership
      const actualUserId = await getActualUserId(request.user.userId);
      const business = await businessService.findById(request.params.businessId);
      
      if (!business) {
        return reply.code(404).send({
          success: false,
          error: 'Business not found',
        });
      }

      // Verify ownership
      if (business.userId !== actualUserId) {
        fastify.log.warn('Authorization failed:', {
          businessUserId: business.userId,
          actualUserId,
          authUserId: request.user.userId,
          businessId: business.id
        });
        
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized - You can only upload media for your own business',
        });
      }

      // Delete existing logo if it exists
      if (business.logo) {
        try {
          await uploadHelper.deleteByResource('business', business.id, 'logo');
        } catch (deleteError) {
          fastify.log.warn('Failed to delete existing logo:', deleteError);
          // Continue with upload even if deletion fails
        }
      }

      // Get preset configuration for business logo
      const { context: baseContext, options } = UniversalImageUploadHelper.getPresetConfig('business_logo');
      
      // Complete the context
      const context = {
        ...baseContext,
        resourceId: business.id,
        authUserId: request.user.userId,
        actualUserId: actualUserId,
        businessId: business.id,
        metadata: {
          businessId: business.id,
          imageType: 'logo'
        }
      } as any;

      console.log('context bsdfjhsd', context);

      // Upload using universal helper
      const { successful, failed } = await uploadHelper.uploadFromMultipart(request, context, options);

      if (successful.length === 0) {
        const failError = failed[0]?.error || 'Upload failed';
        return reply.code(400).send({
          success: false,
          error: failError,
        });
      }

      const uploadedMedia = successful[0]!;

      // Update business with new logo ID
      await businessService.update(business.id, {
        logo: uploadedMedia.id,
      });

      return {
        success: true,
        data: {
          logo: {
            id: uploadedMedia.id,
            url: uploadedMedia.url,
            thumbnailUrl: uploadedMedia.thumbnailUrl,
          },
          message: 'Business logo uploaded successfully',
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  });

  // Upload business banner
  fastify.post<{ Params: { businessId: string } }>('/:businessId/banner', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        businessId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            banner: Type.Object({
              id: Type.String(),
              url: Type.String(),
              thumbnailUrl: Type.Optional(Type.String()),
            }),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const actualUserId = await getActualUserId(request.user.userId);
      const business = await businessService.findById(request.params.businessId);
      
      if (!business) {
        return reply.code(404).send({
          success: false,
          error: 'Business not found',
        });
      }

      // Verify ownership
      if (business.userId !== actualUserId) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized - You can only upload media for your own business',
        });
      }

      // Delete banner
      if (business.banner) {
        try {
          await uploadHelper.deleteByResource('business', business.id, 'banner');
        } catch (deleteError) {
          fastify.log.warn('Failed to delete existing banner:', deleteError);
        }
      }

      // Get preset configuration for business banner
      const { context: baseContext, options } = UniversalImageUploadHelper.getPresetConfig('business_banner');
      // Complete the context
      const context = {
        ...baseContext,
        resourceId: business.id,
        authUserId: request.user.userId,
        actualUserId: actualUserId,
        businessId: business.id,
        metadata: {
          businessId: business.id,
          imageType: 'banner'
        }
      } as any;

      // Upload using universal helper
      const { successful, failed } = await uploadHelper.uploadFromMultipart(request, context, options);

      if (successful.length === 0) {
        const failError = failed[0]?.error || 'Upload failed';
        return reply.code(400).send({
          success: false,
          error: failError,
        });
      }

      const uploadedMedia = successful[0]!;

      // Update business with new banner ID
      await businessService.update(business.id, {
        banner: uploadedMedia.id,
      });

      return {
        success: true,
        data: {
          banner: {
            id: uploadedMedia.id,
            url: uploadedMedia.url,
            thumbnailUrl: uploadedMedia.thumbnailUrl,
          },
          message: 'Business banner uploaded successfully',
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  });

  // Delete business logo
  fastify.delete<{ Params: { businessId: string } }>('/:businessId/logo', {
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
  }, async (request, reply) => {
    try {
      const actualUserId = await getActualUserId(request.user.userId);
      const business = await businessService.findById(request.params.businessId);
      
      if (!business) {
        return reply.code(404).send({
          success: false,
          error: 'Business not found',
        });
      }

      // Verify ownership
      if (business.userId !== actualUserId) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized - You can only delete media for your own business',
        });
      }

      if (!business.logo) {
        return reply.code(404).send({
          success: false,
          error: 'No logo to delete',
        });
      }

      // Delete from media service
      await uploadHelper.deleteByResource('business', business.id, 'logo');

      // Update business table to remove logo reference
      await businessService.update(business.id, {
        logo: null,
      });

      return {
        success: true,
        message: 'Business logo deleted successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  });

  // Delete business banner
  fastify.delete<{ Params: { businessId: string } }>('/:businessId/banner', {
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
  }, async (request, reply) => {
    try {
      const actualUserId = await getActualUserId(request.user.userId);
      const business = await businessService.findById(request.params.businessId);
      
      if (!business) {
        return reply.code(404).send({
          success: false,
          error: 'Business not found',
        });
      }

      // Verify ownership
      if (business.userId !== actualUserId) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized - You can only delete media for your own business',
        });
      }

      if (!business.banner) {
        return reply.code(404).send({
          success: false,
          error: 'No banner to delete',
        });
      }

      // Delete from media service
      await uploadHelper.deleteByResource('business', business.id, 'banner');

      // Update business table to remove banner reference
      await businessService.update(business.id, {
        banner: null,
      });

      return {
        success: true,
        message: 'Business banner deleted successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  });
};

export default businessMediaRoutes;