import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { CommentService } from '../services/commentService';
import { PostService } from '../services/postService';
import { UserProfileService } from '../services/userProfileService';

const commentRoutes: FastifyPluginAsync = async (fastify) => {
  const commentService = new CommentService(fastify.db);
  const postService = new PostService(fastify.db);
  const userProfileService = new UserProfileService(fastify.db);

  // Get comments for a post
  fastify.get<{
    Params: { postId: string };
    Querystring: { limit?: number; offset?: number };
  }>('/posts/:postId/comments', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      querystring: Type.Object({
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
    const { postId } = request.params;
    // const { limit, offset } = request.query;
    const limit = request.query.limit ?? 10;
    const offset = request.query.offset ?? 0;

    // Check if post exists
    const post = await postService.findById(postId);
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    const result = await commentService.getCommentsByPost(postId, { limit, offset });
    
    return {
      success: true,
      ...result,
    };
  });

  // Add comment to post
  fastify.post<{
    Params: { postId: string };
    Body: { content: string };
  }>('/posts/:postId/comments', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        postId: Type.String(),
      }),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request, reply) => {
    const { postId } = request.params;
    const { content } = request.body;
    const authUserId = request.user.userId;
    
    // Check if post exists
    const post = await postService.findById(postId);
    if (!post) {
      return reply.code(404).send({
        success: false,
        error: 'Post not found',
      });
    }

    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return reply.code(403).send({
        success: false,
        error: 'User profile required to comment',
      });
    }

    const comment = await commentService.createComment({
      content,
      postUpdatesId: postId,
      userProfileId: userProfile.id,
    });

    return reply.code(201).send({
      success: true,
      data: comment,
    });
  });

  // Update comment
  fastify.put<{
    Params: { commentId: string };
    Body: { content: string };
  }>('/comments/:commentId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        commentId: Type.String(),
      }),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request, reply) => {
    const { commentId } = request.params;
    const { content } = request.body;
    const authUserId = request.user.userId;
    
    // Get comment
    const comment = await commentService.findCommentById(commentId);
    if (!comment) {
      return reply.code(404).send({
        success: false,
        error: 'Comment not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || comment.userProfileId !== userProfile.id) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to update this comment',
      });
    }

    const updated = await commentService.updateComment(commentId, content);
    
    return {
      success: true,
      data: updated,
    };
  });

  // Delete comment
  fastify.delete<{Params:{commentId: string}}>('comments/:commentId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        commentId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          message: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { commentId } = request.params;
    const authUserId = request.user.userId;
    
    // Get comment
    const comment = await commentService.findCommentById(commentId);
    if (!comment) {
      return reply.code(404).send({
        success: false,
        error: 'Comment not found',
      });
    }

    // Check ownership
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile || comment.userProfileId !== userProfile.id) {
      return reply.code(403).send({
        success: false,
        error: 'Unauthorized to delete this comment',
      });
    }

    await commentService.deleteComment(commentId);
    
    return {
      success: true,
      message: 'Comment deleted successfully',
    };
  });

  // Get comment replies
  fastify.get<{
    Params: { commentId: string };
    Querystring: { limit?: number; offset?: number };
  }>('/comments/:commentId/replies', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        commentId: Type.String(),
      }),
      querystring: Type.Object({
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
    const { commentId } = request.params;
   const limit = request.query.limit ?? 10;
   const offset = request.query.offset ?? 0;
    
    // Check if comment exists
    const comment = await commentService.findCommentById(commentId);
    if (!comment) {
      return reply.code(404).send({
        success: false,
        error: 'Comment not found',
      });
    }

    const result = await commentService.getRepliesByComment(commentId, { limit, offset });
    
    return {
      success: true,
      ...result,
    };
  });

  // Add reply to comment
  fastify.post<{
  Params: { commentId: string };
  Body: { content: string };
}>('/comments/:commentId/replies', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        commentId: Type.String(),
      }),
      body: Type.Object({
        content: Type.String({ minLength: 1 }),
      }),
      response: {
        201: Type.Object({
          success: Type.Boolean(),
          data: Type.Any(),
        }),
      },
    },
  }, async (request, reply) => {
  try {
    const { commentId } = request.params;
    const { content } = request.body;
    const authUserId = request.user.userId;
    
    // Check if comment exists
    const comment = await commentService.findCommentById(commentId);
    if (!comment) {
      return reply.code(404).send({
        success: false,
        error: 'Comment not found',
      });
    }

    // Get user profile
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) {
      return reply.code(403).send({
        success: false,
        error: 'User profile required to reply',
      });
    }

    const reply_obj = await commentService.createReply({
      content,
      commentsId: commentId,
      userProfileId: userProfile.id,
    });
    // // Return a clean response with basic reply data and author info
    // const responseData = {
    //   content: newReply.content,
    // };

    return reply.code(201).send({
      success: true,
      data: reply_obj.content,
    });
  } catch (error) {
    console.error('Error creating reply:', error);
    return reply.code(500).send({
      success: false,
      error: 'Failed to create reply',
    });
  }
  });
};

export default commentRoutes;