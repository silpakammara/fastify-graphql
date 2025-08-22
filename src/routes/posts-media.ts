import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MediaServiceNew } from '../services/mediaServiceNew';
import multipart from '@fastify/multipart';
import { PostServiceDrizzleQueryOptimized } from '../services/postServiceDrizzleQueryOptimized';
import { eq } from 'drizzle-orm';
import { user } from '../models/user';
import { postUpdates } from '../models/post_updates'; 
import { UniversalImageUploadHelper } from '../services/universalMediaUploader';

const postsMediaRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart support
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for post images
      files: 10, // Max 10 files per request
    },
  });

  const uploadHelper = new UniversalImageUploadHelper(fastify);
  const postService = new PostServiceDrizzleQueryOptimized(fastify.db);
    const mediaService = new MediaServiceNew(fastify.db);

  // Helper function to update post_updates table with media references
  const updatePostMediaReferences = async (postId: string) => {
    try {
      // Get all media for this post
      const allMedia = await mediaService.getByResource('post', postId);
  
      const featuredMedia = allMedia.find(m => m.tag === 'featured_image');
      const galleryMedia = allMedia.filter(m => m.tag === 'gallery');
      
      // Sort gallery images by position
      galleryMedia.sort((a, b) => (a.position || 0) - (b.position || 0));
      
      await fastify.db
        .update(postUpdates)
        .set({
          featuredImage: featuredMedia?.id || null,
          images: galleryMedia.length > 0 ? galleryMedia.map(m => m.id) : null,
          updatedAt: new Date(),
        })
        .where(eq(postUpdates.id, postId));
        
    } catch (error) {
      fastify.log.error('Failed to update post media references:', error);
      throw error;
    }
  };

  // Upload images for a post
  fastify.post<{ Params: { postId: string } }>('/:postId/images', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            images: Type.Array(Type.Object({
              id: Type.String(),
              url: Type.String(),
              thumbnailUrl: Type.Optional(Type.String()),
              order: Type.Number(),
            })),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
    // Query to get the actual user ID from auth user ID
    const [userRecord] = await fastify.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.userAuthId, request.user.userId))
      .limit(1);
    
    if (!userRecord) {
      return reply.code(401).send({
        success: false,
        error: 'User not found',
      });
    }
    
    const actualUserId = userRecord.id;
    
      // Verify post ownership
     const post = await postService.findById(request.params.postId, actualUserId);

    // Check ownership using the actual user ID
    const isOwner = post.postByUserId === actualUserId || 
                   (post.postByBusinessId && post.postByBusinessId === request.user.businessId);
    
    if (!isOwner) {
      console.log('Ownership check failed');
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized - You can only upload images to your own posts',
      });
    }

      // Check if this is the first image (will be featured)
      const existingMedia = await uploadHelper.getExistingMedia('post', request.params.postId);
      const isFirstImage = existingMedia.length === 0;

      // Get preset configuration for post images
      const { context: baseContext, options } = UniversalImageUploadHelper.getPresetConfig('post_image');
      
      // Complete the context
      const context = {
        ...baseContext,
            resourceId: request.params.postId,
        authUserId: request.user.userId,
        actualUserId: actualUserId,
            tag: isFirstImage ? 'featured_image' : 'gallery',
            metadata: {
              postId: request.params.postId,
              imageType: isFirstImage ? 'featured' : 'post_image'
        }
      } as any;

      // Upload using universal helper
      const { successful, failed } = await uploadHelper.uploadFromMultipart(request, context, options);

      if (successful.length === 0) {
        return reply.code(400).send({
          success: false,
          error: failed.length > 0 
          ? `Upload failed: ${failed.map(f => f.error).join(', ')}`
          : 'No valid images uploaded',
      });
    }

      // Update post_updates table with new media references
      await updatePostMediaReferences(request.params.postId);

      // Transform results for response
      const uploadedImages = successful.map(media => ({
        id: media.id,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        order: media.position,
      }));

      const message = `${successful.length} image(s) uploaded successfully${
        failed.length > 0 ? ` (${failed.length} failed)` : ''
      }`;

      return {
        success: true,
        data: {
          images: uploadedImages,
          message,
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

  // Delete a specific image from a post
  fastify.delete<{ Params: { postId: string; imageId: string } }>('/:postId/images/:imageId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
        imageId: Type.String(),
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
      // Get actual user ID
      const [userRecord] = await fastify.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.userAuthId, request.user.userId))
        .limit(1);
      
      if (!userRecord) {
        return reply.code(401).send({
          success: false,
          error: 'User not found',
        });
      }

      const actualUserId = userRecord.id;

      // Verify post ownership
      const post = await postService.findById(request.params.postId, actualUserId);
      if (!post) {
        return reply.code(404).send({
          success: false,
          error: 'Post not found',
        });
      }

      // Check ownership
      const isOwner = post.postByUserId === actualUserId || 
                     (post.postByBusinessId && post.postByBusinessId === request.user.businessId);
      
      if (!isOwner) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Get the media record to verify it belongs to this post
      const mediaRecords = await mediaService.getByResource('post', request.params.postId);
      const mediaExists = mediaRecords.some((m:any) => m.id === request.params.imageId);
      
      if (!mediaExists) {
        return reply.code(404).send({
          success: false,
          error: 'Image not found in this post',
        });
      }

      // Delete from media service
      await uploadHelper.deleteMedia(request.params.imageId);
      // Update post_updates table after deletion
      await updatePostMediaReferences(request.params.postId);

      return {
        success: true,
        message: 'Image deleted successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      });
    }
  });

  // Reorder images in a post
  fastify.put<{ 
    Params: { postId: string };
    Body: { imageOrders: Array<{ id: string; order: number }> };
  }>('/:postId/images/reorder', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      body: Type.Object({
        imageOrders: Type.Array(Type.Object({
          id: Type.String(),
          order: Type.Number({ minimum: 0 }),
        })),
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
      // Get actual user ID
      const [userRecord] = await fastify.db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.userAuthId, request.user.userId))
        .limit(1);
      
      if (!userRecord) {
        return reply.code(401).send({
          success: false,
          error: 'User not found',
        });
      }

      const actualUserId = userRecord.id;

      // Verify post ownership
      const post = await postService.findById(request.params.postId, actualUserId);
      if (!post) {
        return reply.code(404).send({
          success: false,
          error: 'Post not found',
        });
      }
      // Check ownership
      const isOwner = post.postByUserId === actualUserId || 
                    (post.postByBusinessId && post.postByBusinessId === request.user.businessId);
      if (!isOwner) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized',
        });
      }

      // Get existing media for this post
      const mediaRecords = await mediaService.getByResource('post', request.params.postId);
      const mediaIds = new Set(mediaRecords.map(m => m.id));

      // Update position for each image
      for (const { id, order } of request.body.imageOrders) {
        if (mediaIds.has(id)) {
          await mediaService.updatePosition(id, order);
        }
      }
      // Update post_updates table after reordering
      await updatePostMediaReferences(request.params.postId);

      return {
        success: true,
        message: 'Image order updated successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Reorder failed',
      });
    }
  });

  // Get all images for a post
  fastify.get<{ Params: { postId: string } }>('/:postId/images', {
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            images: Type.Array(Type.Object({
              id: Type.String(),
              url: Type.String(),
              thumbnailUrl: Type.Optional(Type.String()),
              order: Type.Number(),
              uploadedAt: Type.String(),
            })),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    try {
      const post = await postService.findById(request.params.postId);
      if (!post) {
        return reply.code(404).send({
          success: false,
          error: 'Post not found',
        });
      }

      const media = await mediaService.getByResource('post', request.params.postId, 'gallery');
      const images = media
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map(m => ({
          id: m.id,
          url: m.url,
          thumbnailUrl: m.thumbnailUrl || undefined,
          order: m.position || 0,
          uploadedAt: m.uploadedAt.toISOString(),
        }));

      return {
        success: true,
        data: {
          images,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get images',
      });
    }
  });
};

export default postsMediaRoutes;