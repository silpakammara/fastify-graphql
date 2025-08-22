import { FastifyPluginAsync } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { MediaService } from '../services/mediaService';
import multipart from '@fastify/multipart';

// Request/Response schemas
const UploadResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    media: Type.Object({
      id: Type.String(),
      url: Type.String(),
      thumbnailUrl: Type.Optional(Type.String()),
      filename: Type.String(),
      mimeType: Type.String(),
      size: Type.Number(),
      uploadedAt: Type.String(),
      variants: Type.Optional(Type.Record(Type.String(), Type.String())),
    }),
  }),
});

const UploadFromUrlSchema = Type.Object({
  url: Type.String({ format: 'uri' }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const MediaListResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Object({
    items: Type.Array(Type.Object({
      id: Type.String(),
      url: Type.String(),
      thumbnailUrl: Type.Optional(Type.String()),
      filename: Type.String(),
      mimeType: Type.String(),
      size: Type.Number(),
      uploadedAt: Type.String(),
    })),
    pagination: Type.Object({
      page: Type.Number(),
      totalPages: Type.Number(),
      total: Type.Number(),
      limit: Type.Number(),
    }),
  }),
});

const mediaRoutes: FastifyPluginAsync = async (fastify) => {
  // Register multipart support
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1, // Max 1 file per request
    },
  });

  const mediaService = new MediaService(fastify.db, fastify);

  // Upload image file
  // fastify.post(
  //   '/upload',
  //   {
  //     onRequest: [fastify.authenticate],
  //     schema: {
  //       response: {
  //         200: UploadResponseSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     try {
  //       const data = await request.file();
  //       if (!data) {
  //         return reply.code(400).send({
  //           success: false,
  //           error: 'No file uploaded',
  //         });
  //       }

  //       const buffer = await data.toBuffer();
  //       const metadata = data.fields.metadata as any;

  //       const result = await mediaService.uploadImage(
  //         request.user.userId,
  //         buffer,
  //         data.filename,
  //         data.mimetype,
  //         metadata?.value ? JSON.parse(metadata.value) : undefined
  //       );

  //       return reply.send({
  //         success: true,
  //         data: {
  //           media: {
  //             id: result.media.id,
  //             url: result.media.url,
  //             thumbnailUrl: result.media.thumbnailUrl,
  //             filename: result.media.filename,
  //             mimeType: result.media.mimeType,
  //             size: result.media.size,
  //             uploadedAt: result.media.uploadedAt.toISOString(),
  //             variants: result.media.variants,
  //           },
  //         },
  //       });
  //     } catch (error) {
  //       fastify.log.error(error);
  //       return reply.code(500).send({
  //         success: false,
  //         error: error instanceof Error ? error.message : 'Upload failed',
  //       });
  //     }
  //   }
  // );

  // Upload from URL
  // fastify.post<{ Body: Static<typeof UploadFromUrlSchema> }>(
  //   '/upload-url',
  //   {
  //     onRequest: [fastify.authenticate],
  //     schema: {
  //       body: UploadFromUrlSchema,
  //       response: {
  //         200: UploadResponseSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     try {
  //       const { url, metadata } = request.body;

  //       const result = await mediaService.uploadFromUrl(
  //         request.user.userId,
  //         url,
  //         metadata
  //       );

  //       return reply.send({
  //         success: true,
  //         data: {
  //           media: {
  //             id: result.media.id,
  //             url: result.media.url,
  //             thumbnailUrl: result.media.thumbnailUrl,
  //             filename: result.media.filename,
  //             mimeType: result.media.mimeType,
  //             size: result.media.size,
  //             uploadedAt: result.media.uploadedAt.toISOString(),
  //             variants: result.media.variants,
  //           },
  //         },
  //       });
  //     } catch (error) {
  //       fastify.log.error(error);
  //       return reply.code(500).send({
  //         success: false,
  //         error: error instanceof Error ? error.message : 'Upload from URL failed',
  //       });
  //     }
  //   }
  // );

  // Get media by ID
  // fastify.get<{ Params: { id: string } }>(
  //   '/:id',
  //   {
  //     onRequest: [fastify.authenticate],
  //     schema: {
  //       params: Type.Object({
  //         id: Type.String(),
  //       }),
  //     },
  //   },
  //   async (request, reply) => {
  //     try {
  //       const media = await mediaService.getById(request.params.id, request.user.userId);
        
  //       if (!media) {
  //         return reply.code(404).send({
  //           success: false,
  //           error: 'Media not found',
  //         });
  //       }

  //       return reply.send({
  //         success: true,
  //         data: {
  //           media: {
  //             id: media.id,
  //             url: media.url,
  //             thumbnailUrl: media.thumbnailUrl,
  //             filename: media.filename,
  //             mimeType: media.mimeType,
  //             size: media.size,
  //             uploadedAt: media.uploadedAt.toISOString(),
  //             variants: media.variants,
  //             metadata: media.metadata,
  //           },
  //         },
  //       });
  //     } catch (error) {
  //       fastify.log.error(error);
  //       return reply.code(500).send({
  //         success: false,
  //         error: 'Failed to get media',
  //       });
  //     }
  //   }
  // );

  // List user's media
  // fastify.get<{ Querystring: { page?: number; limit?: number } }>(
  //   '/',
  //   {
  //     onRequest: [fastify.authenticate],
  //     schema: {
  //       querystring: Type.Object({
  //         page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  //         limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  //       }),
  //       response: {
  //         200: MediaListResponseSchema,
  //       },
  //     },
  //   },
  //   async (request, reply) => {
  //     try {
  //       const { page = 1, limit = 20 } = request.query;
        
  //       const result = await mediaService.listUserMedia(
  //         request.user.userId,
  //         page,
  //         limit
  //       );

  //       return reply.send({
  //         success: true,
  //         data: {
  //           items: result.items.map(item => ({
  //             id: item.id,
  //             url: item.url,
  //             thumbnailUrl: item.thumbnailUrl,
  //             filename: item.filename,
  //             mimeType: item.mimeType,
  //             size: item.size,
  //             uploadedAt: item.uploadedAt.toISOString(),
  //           })),
  //           pagination: {
  //             page: result.page,
  //             totalPages: result.totalPages,
  //             total: result.total,
  //             limit,
  //           },
  //         },
  //       });
  //     } catch (error) {
  //       fastify.log.error(error);
  //       return reply.code(500).send({
  //         success: false,
  //         error: 'Failed to list media',
  //       });
  //     }
  //   }
  // );

  // Delete media
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: Type.Object({
          id: Type.String(),
        }),
      },
    },
    async (request, reply) => {
      try {
        await mediaService.deleteMedia(request.params.id, request.user.userId);

        return reply.send({
          success: true,
          data: {
            message: 'Media deleted successfully',
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete media',
        });
      }
    }
  );

  // Update media metadata
  fastify.put<{ Params: { id: string }; Body: { metadata: Record<string, any> } }>(
    '/:id/metadata',
    {
      onRequest: [fastify.authenticate],
      schema: {
        params: Type.Object({
          id: Type.String(),
        }),
        body: Type.Object({
          metadata: Type.Record(Type.String(), Type.Any()),
        }),
      },
    },
    async (request, reply) => {
      try {
        const media = await mediaService.updateMetadata(
          request.params.id,
          request.user.userId,
          request.body.metadata
        );

        return reply.send({
          success: true,
          data: {
            media: {
              id: media.id,
              metadata: media.metadata,
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update metadata',
        });
      }
    }
  );

  // Get user's gallery (profile pics and post images)
  fastify.get<{ 
    Querystring: { 
      type?: 'profile' | 'posts' | 'all';
      limit?: number;
      offset?: number;
    } 
  }>(
    '/gallery',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: Type.Object({
          type: Type.Optional(Type.Union([
            Type.Literal('profile'),
            Type.Literal('posts'),
            Type.Literal('all'),
          ])),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
          offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              items: Type.Array(Type.Object({
                type: Type.Union([Type.Literal('profile'), Type.Literal('post')]),
                user: Type.Optional(Type.Object({
                  id: Type.String(),
                  name: Type.String(),
                  profilePicUrl: Type.Optional(Type.String()),
                })),
                business: Type.Optional(Type.Object({
                  id: Type.String(),
                  name: Type.String(),
                  logoUrl: Type.Optional(Type.String()),
                })),
                post: Type.Optional(Type.Object({
                  id: Type.String(),
                  content: Type.Optional(Type.String()),
                  createdAt: Type.String(),
                  imageCount: Type.Number(),
                  images: Type.Array(Type.Object({
                    id: Type.String(),
                    url: Type.String(),
                  imageType: Type.Union([Type.Literal('featured'), Type.Literal('gallery')]),
                })),
              })),
              })),
              total: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await mediaService.getAllGalleryData(request.query);

        return reply.send({
          success: true,
          data: {
            items: result.items.map(item => ({
              ...item,
              post: item.post ? {
                ...item.post,
                createdAt: item.post.createdAt.toISOString(),
              } : undefined,
            })),
            total: result.total,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to get gallery',
        });
      }
    }
  );

  // Get media by type/filters
  fastify.get<{ 
    Querystring: { 
      userId?: string;
      mimeType?: string;
      metadata?: string; // JSON string
      limit?: number;
      offset?: number;
    } 
  }>(
    '/list',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: Type.Object({
          userId: Type.Optional(Type.String()),
          mimeType: Type.Optional(Type.String()),
          metadata: Type.Optional(Type.String()), // JSON string
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
          offset: Type.Optional(Type.Number({ minimum: 0, default: 0 })),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              items: Type.Array(Type.Object({
                id: Type.String(),
                userId: Type.Union([Type.String(), Type.Null()]),
                cloudflareId: Type.String(),
                filename: Type.String(),
                originalFilename: Type.String(),
                mimeType: Type.String(),
                size: Type.Number(),
                url: Type.String(),
                thumbnailUrl: Type.Union([Type.String(), Type.Null()]),
                variants: Type.Any(),
                metadata: Type.Union([Type.Any(), Type.Null()]),
                uploadedAt: Type.String(),
              })),
              total: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { metadata, ...filters } = request.query;
        const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;

        const result = await mediaService.getMediaByType({
          ...filters,
          metadata: parsedMetadata,
        });

        return reply.send({
          success: true,
          data: {
            items: result.items.map(item => ({
              ...item,
              userId: item.authUserId || null,
              uploadedAt: item.uploadedAt.toISOString(),
            })),
            total: result.total,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to list media',
        });
      }
    }
  );

  // Get media statistics
  fastify.get<{ Querystring: { userId?: string } }>(
    '/stats',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: Type.Object({
          userId: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              totalImages: Type.Number(),
              totalSize: Type.Number(),
              byMimeType: Type.Array(Type.Object({
                mimeType: Type.String(),
                count: Type.Number(),
                totalSize: Type.Number(),
              })),
              recentUploads: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const stats = await mediaService.getMediaStats(request.query.userId);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to get media stats',
        });
      }
    }
  );

  // Bulk delete media
  fastify.delete<{ Body: { mediaIds: string[] } }>(
    '/bulk',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: Type.Object({
          mediaIds: Type.Array(Type.String(), { minItems: 1, maxItems: 100 }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              deleted: Type.Number(),
              failed: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await mediaService.bulkDeleteMedia(
          request.body.mediaIds,
          request.user.userId
        );

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to bulk delete media',
        });
      }
    }
  );
};

export default mediaRoutes;