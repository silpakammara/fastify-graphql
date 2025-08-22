
import { UserProfileServiceSimple } from "../../services/userProfileServiceSimple"

export const userResolvers=(db:any)=>{
     const userService=new UserProfileServiceSimple(db)

     return {
       Query: {
         user: async (_: any, { id }: { id: string }) => {
           return userService.findById(id);
         },
         users: async (_: any, { filters }: any) => {
           return userService.list(filters || {});
         },
       },
       Mutation: {
         createUser: async (_: any, { data }: any, ctx: any) => {
           if (!ctx.user) throw new Error("Unauthorized");
           data.userAuthId = ctx.user.userId;
           return userService.create(data);
         },
         updateUser: async (_: any, { id, data }: any, ctx: any) => {
           if (!ctx.user) throw new Error("Unauthorized")
             const existing = await userService.findById(id);
             if (!existing) throw new Error("User not found");
             if (existing.userAuthId !== ctx.user.userId) {
               throw new Error(
                 "Forbidden: You can only update your own profile" 
               );
             }
           return userService.update(id, data);
         },

         deleteUser: async (_: any, { id }: any, ctx: any) => {
           if (!ctx.user) throw new Error("Unauthorized");
           const existing = await userService.findById(id);
           console.log(existing, ctx.user);
           if (!existing) throw new Error("User not found");
           if (existing.userAuthId !== ctx.user.userId) {
             throw new Error("Forbidden: You can only delete your own profile");
           }
           return userService.delete(id);
         },
       },
     };
}