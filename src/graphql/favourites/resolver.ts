import { FavouriteService } from "../../services/favouriteService";
import { UserProfileService } from "../../services/userProfileService";


export const favouriteResolvers = (db: any) => {
  const favouriteService = new FavouriteService(db);
  const userProfileService = new UserProfileService(db);

  const getUserProfile = async (authUserId: string) => {
    const userProfile = await userProfileService.findByAuthUserId(authUserId);
    if (!userProfile) throw new Error("User profile not found");
    return userProfile;
  };

  return {
    Query: {
      favouriteStats: async (_: any, __: any, ctx: any) => {
        const authUserId = ctx.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) return { total: 0, byType: [] };
        return favouriteService.getUserFavouriteStats(userProfile.id);
      },

      checkFavourite: async (_: any, { type, id }: any, ctx: any) => {
        const authUserId = ctx.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) return { success: true, liked: false };
        const liked = await favouriteService.checkFavourite(userProfile.id, type, id);
        return { success: true, liked };
      },

      favouriteCount: async (_: any, { type, id }: any) => {
        const count = await favouriteService.getFavouriteCount(type, id);
        return { success: true, count };
      },

      usersWhoLiked: async (_: any, { contentId, type, limit, offset }: any) => {
        return favouriteService.getUsersWhoLiked(type, contentId, { limit, offset });
      },

      myFavourites: async (_: any, { type, limit, offset }: any, ctx: any) => {
        const authUserId = ctx.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) {
          return { data: [], total: 0, limit: limit || 10, offset: offset || 0 };
        }
        return favouriteService.getUserFavourites(userProfile.id, { likedType: type, limit, offset });
      }
    },

    Mutation: {
      toggleFavourite: async (_: any, { type, id }: any, ctx: any) => {
        const authUserId = ctx.user.userId;
        const userProfile = await getUserProfile(authUserId);
        const result = await favouriteService.toggleFavourite(userProfile.id, type, id);
    return {
      success: true,
      liked: result.liked,
    };
      },

      removeFavourite: async (_: any, { type, id }: any, ctx: any) => {
        const authUserId = ctx.user.userId;
        const userProfile = await getUserProfile(authUserId);
        const result = await favouriteService.removeFavourite(userProfile.id, type, id);
        if (!result) {
          return { success: false, message: "Favourite not found or already removed" };
        }
        return { success: true, message: "Favourite removed successfully" };
      },
    }
  };
};
