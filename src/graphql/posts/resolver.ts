import { BusinessService } from "../../services/businessService";
import { PostServiceDrizzleQueryOptimized } from "../../services/postServiceDrizzleQueryOptimized";
import { UserProfileServiceSimple } from "../../services/userProfileServiceSimple";


export const postResolvers = (db: any) => {
  const postService = new PostServiceDrizzleQueryOptimized(db);
  const userProfileService = new UserProfileServiceSimple(db);
  const businessService = new BusinessService(db);

  return {
    Query: {
      posts: async (_: any, { filters }: any, ctx: any) => {
        const { onlyMine, ...rest } = filters || {};
        let userId = rest.userId;

        const userProfile = await userProfileService.findByAuthUserId(ctx.reply.request.user.userId);
        if (onlyMine && userProfile) {
          userId = userProfile.id;
        }
        const result = await postService.list({ ...rest, userId }, userProfile?.id);
        return { success: true, ...result };
      },

      post: async (_: any, { id }: any, ctx: any) => {
        const currentUserProfile = await userProfileService.findByAuthUserId(ctx.reply.request.user.userId);
        const post = await postService.findById(id, currentUserProfile?.id);
        if (!post) return { success: false, data: null };
        return { success: true, data: post };
      },

      postsByUser: async (_: any, { userId, limit, offset }: any) => {
        const result = await postService.getUserFeed(userId, { limit, offset });
        return { success: true, ...result };
      },

      postsByBusiness: async (_: any, { businessId, limit, offset }: any) => {
        const result = await postService.list({ businessId, limit, offset });
        return { success: true, ...result };
      },
    },

    Mutation: {
      createPost: async (_: any, { data }: any, ctx: any) => {
        const authUserId = ctx.reply.request.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);

        if (!userProfile) {
          throw new Error('User profile required to create posts');
        }

        const business = await businessService.findByUserId(userProfile.id);

        const cleanedBody = { ...data };
        Object.keys(cleanedBody).forEach(key => {
          if (cleanedBody[key] === 'string' || cleanedBody[key] === '') {
            cleanedBody[key] = undefined;
          }
        });
        if (!Array.isArray(cleanedBody.images)) {
            cleanedBody.images = [];
            }
        const post = await postService.create({
          ...cleanedBody,
          postByUserId: userProfile.id,
          postByBusinessId: business?.[0]?.id ?? null,
          publishedAt: cleanedBody.publishedAt ? new Date(cleanedBody.publishedAt) : new Date(),
        });
        return { success: true, data: post };
      },

      updatePost: async (_: any, { id, data }: any, ctx: any) => {
        const authUserId = ctx.reply.request.user.userId;
        const post = await postService.findById(id);
        if (!post) throw new Error('Post not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || post.postByUserId !== userProfile.id) {
          if (post.postByBusinessId) {
            const business = await businessService.findById(post.postByBusinessId);
            if (!business || business.userId !== userProfile?.id) {
              throw new Error('Unauthorized to update this post');
            }
          } else {
            throw new Error('Unauthorized to update this post');
          }
        }

        const cleanedBody = { ...data };
        Object.keys(cleanedBody).forEach(key => {
          if (cleanedBody[key] === 'string' || cleanedBody[key] === '') {
            cleanedBody[key] = null;
          }
        });

        const updated = await postService.update(id, cleanedBody);
        return { success: true, data: updated };
      },

      deletePost: async (_: any, { id }: any, ctx: any) => {
        const authUserId = ctx.reply.request.user.userId;
        const post = await postService.findById(id);
        if (!post) throw new Error('Post not found');

        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || post.postByUserId !== userProfile.id) {
          if (post.postByBusinessId) {
            const business = await businessService.findById(post.postByBusinessId);
            if (!business || business.userId !== userProfile?.id) {
              throw new Error('Unauthorized to delete this post');
            }
          } else {
            throw new Error('Unauthorized to delete this post');
          }
        }

        await postService.delete(id);
        return { success: true, message: 'Post deleted successfully' };
      },
    },
  };
};
