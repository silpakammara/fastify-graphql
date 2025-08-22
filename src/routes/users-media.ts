import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MediaServiceNew } from '../services/mediaServiceNew';
import { UserProfileServiceSimple } from '../services/userProfileServiceSimple';
import multipart from '@fastify/multipart';
import { eq } from 'drizzle-orm';
import { user } from '../models/user';
import { UniversalImageUploadHelper } from '../services/universalMediaUploader';

const userMediaRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart support
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for profile pics
      files: 1,
    },
  });

  const mediaService = new MediaServiceNew(fastify.db);
  const userProfileService = new UserProfileServiceSimple(fastify.db);
   const uploadHelper = new UniversalImageUploadHelper(fastify);

   const getActualUserId = async (authUserId: string) => {
    const [userRecord] = await fastify.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.userAuthId, authUserId))
      .limit(1);
    
    if (!userRecord) throw new Error('User not found');
    return userRecord.id;
  };

  // Upload profile picture
  fastify.post('/profile-picture', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            profilePic: Type.Object({
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
      // Get user info
      const actualUserId = await getActualUserId(request.user.userId);
      const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
      
      if (!userProfile) {
        return reply.code(404).send({
          success: false,
          error: 'User profile not found',
        });
      }

      // Get preset configuration for profile picture
      const { context: baseContext, options } = UniversalImageUploadHelper.getPresetConfig('profile_pic');
      // Complete the context
      const context = {
        ...baseContext,
        resourceId: userProfile.id,
        authUserId: request.user.userId,
        actualUserId: actualUserId,
        metadata: {
          userProfileId: userProfile.id,
          mediaType: 'profile_pic'
        }
      } as any;

     //upload the file 
      const { successful, failed } = await uploadHelper.uploadFromMultipart(request, context, options);

      if (successful.length === 0) {
          const firstError = failed[0]?.error || 'Upload failed';
        return reply.code(400).send({
          success: false,
          error: firstError,
        });
      }

      const uploadedMedia = successful[0]!;

      // Update user profile with new media ID
      await userProfileService.update(userProfile.id, {
        profilePic: uploadedMedia.id,
      });

      return {
        success: true,
        data: {
          profilePic: {
            id: uploadedMedia.id,
            url: uploadedMedia.url,
            thumbnailUrl: uploadedMedia.thumbnailUrl,
          },
          message: 'Profile picture uploaded successfully',
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

  fastify.post('/banner', {
    preHandler: [fastify.authenticate],
    schema: {
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
      // Get user info
      const actualUserId = await getActualUserId(request.user.userId);
      const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
      
      if (!userProfile) {
        return reply.code(404).send({
          success: false,
          error: 'User profile not found',
        });
      }

      // Get preset configuration for banner
      const { context: baseContext, options } = UniversalImageUploadHelper.getPresetConfig('banner');
      
      // Complete the context
      const context = {
        ...baseContext,
        resourceId: userProfile.id,
        authUserId: request.user.userId,
        actualUserId: actualUserId,
        metadata: {
          userProfileId: userProfile.id,
          mediaType: 'banner'
        }
      } as any;

      // Upload using universal helper
      const { successful, failed } = await uploadHelper.uploadFromMultipart(request, context, options);

      if (successful.length === 0) {
          const firstError = failed[0]?.error || 'Upload failed';
        return reply.code(400).send({
          success: false,
          error: firstError,
        });
      }

      const uploadedMedia = successful[0]!;

      // Update user profile with new media ID
      await userProfileService.update(userProfile.id, {
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
          message: 'Banner uploaded successfully',
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



  // Delete profile picture
  fastify.delete('/profile-picture', {
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
    try {
      const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
      if (!userProfile) {
        return reply.code(404).send({
          success: false,
          error: 'User profile not found',
        });
      }

      if (!userProfile.profilePic) {
        return reply.code(404).send({
          success: false,
          error: 'No profile picture to delete',
        });
      }

      // Delete from media service
      await uploadHelper.deleteByResource('user_profile', userProfile.id, 'profile_pic');

      // Update user profile
      await userProfileService.update(userProfile.id, {
        profilePic: null,
      });

      return {
        success: true,
        message: 'Profile picture deleted successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  });

  // Delete banner
  fastify.delete('/banner', {
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
    try {
      const userProfile = await userProfileService.findByAuthUserId(request.user.userId);
      if (!userProfile) {
        return reply.code(404).send({
          success: false,
          error: 'User profile not found',
        });
      }

      if (!userProfile.banner) {
        return reply.code(404).send({
          success: false,
          error: 'No banner to delete',
        });
      }
      // Delete from media service
      await uploadHelper.deleteByResource('user_profile', userProfile.id, 'banner');

      // Update user profile
      await userProfileService.update(userProfile.id, {
        banner: null,
      });
      return {
        success: true,
        message: 'Banner deleted successfully',
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

export default userMediaRoutes;