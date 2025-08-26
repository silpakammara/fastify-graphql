import { CommentService } from "../../services/commentService";
import { PostService } from "../../services/postService";
import { UserProfileService } from "../../services/userProfileService";


export function commentResolvers(db: any) {
  const commentService = new CommentService(db);
  const postService = new PostService(db);
  const userProfileService = new UserProfileService(db);

  return {
    Query: {
      commentsByPost: async (_: any, { postId, limit, offset }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const post = await postService.findById(postId);
        if (!post) throw new Error('Post not found');
        const result = await commentService.getCommentsByPost(postId, { limit, offset });
        return {
          ...result,
          data: result.data.map((comment: any) => ({
            ...comment,
            _authorData: comment.author
          }))
        };
      },
      repliesByComment: async (_: any, { commentId, limit, offset }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const comment = await commentService.findCommentById(commentId);
        if (!comment) throw new Error('Comment not found');
     const result = await commentService.getRepliesByComment(commentId, { limit, offset });

      return {
          ...result,
          data: result.data.map((reply: any) => ({
            ...reply,
            _authorData: reply.author
          }))
        };
      },
    },

    Mutation: {
      addComment: async (_: any, { postId, content }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const post = await postService.findById(postId);
        if (!post) throw new Error('Post not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) throw new Error('User profile required to comment');
        return commentService.createComment({
          content,
          postUpdatesId: postId,
          userProfileId: userProfile.id,
        });
      },

      updateComment: async (_: any, { commentId, content }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const comment = await commentService.findCommentById(commentId);
        if (!comment) throw new Error('Comment not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || comment.userProfileId !== userProfile.id) {
          throw new Error('Unauthorized to update this comment');
        }
        return commentService.updateComment(commentId, content);
      },

      deleteComment: async (_: any, { commentId }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const comment = await commentService.findCommentById(commentId);
        if (!comment) throw new Error('Comment not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || comment.userProfileId !== userProfile.id) {
          throw new Error('Unauthorized to delete this comment');
        }
        await commentService.deleteComment(commentId);
        return true;
      },

      addReply: async (_: any, { commentId, content }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const comment = await commentService.findCommentById(commentId);
        if (!comment) throw new Error('Comment not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) throw new Error('User profile required to reply');

        return commentService.createReply({
          content,
          commentsId: commentId,
          userProfileId: userProfile.id,
        });
      },

    deleteReply:async(_: any, { replyId }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const reply = await commentService.findReplyById(replyId);
        if (!reply) throw new Error('Reply not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || reply.userProfileId !== userProfile.id) {
          throw new Error('Unauthorized to delete this reply');
        }
        await commentService.deleteReply(replyId);
        return {
          success: true,
          message: 'commentReply deleted successfully',
        };
      },

    },

    Comment: {
      replies: (parent: any, { limit = 10, offset = 0 }: any) => {
        return commentService.getRepliesByComment(parent.userId, { limit, offset });
      },
      userProfile: (parent: any) => {
         return parent._authorData || null;
      },
    },
  };
}
