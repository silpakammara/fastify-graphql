import { BusinessServiceSimple } from "../../services/businessServiceSimple";
import { UserProfileServiceSimple } from "../../services/userProfileServiceSimple";


export function businessResolvers(db: any) {
  const businessService = new BusinessServiceSimple(db);
  const userProfileService = new UserProfileServiceSimple(db);

  return {
    Query: {
      businesses: async (_: any, { filters }: any, ctx: any) => {
       await ctx.reply.request.jwtVerify();
        return businessService.list(filters || {});
      },
      business: async (_: any, { id }: any, ctx: any) => {
        await ctx.reply.request.jwtVerify();
        return businessService.findById(id);
      },
    },
    Mutation: {
      createBusiness: async (_: any, { input }: any, ctx: any) => {
         await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) {
          throw new Error('User profile required to create business');
        }
        return businessService.create({
          ...input,
          userId: userProfile.id,
          isVerified: false,
        });
      },
      updateBusiness: async (_: any, { id, input }: any, ctx: any) => {
         await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const business = await businessService.findById(id);
        if (!business) throw new Error('Business not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || business.userId !== userProfile.id) {
          throw new Error('Unauthorized to update this business');
        }
        return businessService.update(id, input);
      },
      deleteBusiness: async (_: any, { id }: any, ctx: any) => {
         await ctx.reply.request.jwtVerify();
        const authUserId = ctx.reply.request.user.userId;
        const business = await businessService.findById(id);
        if (!business) throw new Error('Business not found');
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile || business.userId !== userProfile.id) {
          throw new Error('Unauthorized to delete this business');
        }
        await businessService.delete(id);
        return {
            success: true,
            message: 'Business record deleted successfully',
        };
      },
    },
 };
}
