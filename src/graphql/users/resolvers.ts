
import { UserProfileServiceSimple } from "../../services/userProfileServiceSimple"

export const userResolvers=(db:any)=>{
     const userService=new UserProfileServiceSimple(db)

     return {
       Query: {
         user: async (_: any, { id }: { id: string },ctx:any) => {
           return userService.findById(id);
         },
         users: async (_: any, { filters }: any, ctx:any) => {
           return userService.list(filters || {});
         },
         doctors: async (_: any, args: any, ctx: any) => {
          const { filters = {} } = args;
          return userService.listDoctors({
            specializationIds: filters.specializations,
            cities: filters.cities,
            limit: filters.limit,
            offset: filters.offset,
            currentUserId: ctx.authUser?.id,
          });
        }
       },
       Mutation: {
         createUser: async (_: any, { data }: any, ctx: any) => {
           data.userAuthId = ctx.user.userId;
           return userService.create(data);
         },
         updateUser: async (_: any, { id, data }: any, ctx: any) => {
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
           const existing = await userService.findById(id);
           console.log(existing, ctx.user);
           if (!existing) throw new Error("User not found");
           if (existing.userAuthId !== ctx.user.userId) {
             throw new Error("Forbidden: You can only delete your own profile");
           }
           await userService.delete(id);
           return {
             success: true,
             message: 'User deleted successfully',
           };
         },
       },

       
     };
}