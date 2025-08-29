import { ProfessionalService } from '../../services/professionalService';
import { UserProfileService } from '../../services/userProfileService';

export function professionResolvers(db: any) {
  const professionalService = new ProfessionalService(db);
  const userProfileService = new UserProfileService(db);

  return {
    Query: {
      professions: async (_: any, _args: any, ctx: any) => {
        const result = await professionalService.getAllProfessions();
        return result.data;
      },
      professionsWithStats: async (_: any, _args: any, ctx: any) => {
        return professionalService.getProfessionsWithUserCount();
      },
      searchProfessions: async (_: any, { query }: { query: string }, ctx: any) => {
        return professionalService.searchProfessions(query);
      },

      specializations: async (_: any, _args: any, ctx: any) => {
        return professionalService.getAllSpecializations();
      },
      specializationsByProfession: async (_: any, { professionId }: { professionId: string }, ctx: any) => {
        return professionalService.getSpecializationsByProfession(professionId);
      },
      specializationsWithStats: async (_: any, { professionId }: { professionId?: string }, ctx: any) => {
        return professionalService.getSpecializationsWithUserCount(professionId);
      },
      searchSpecializations: async (
        _: any,
        { query, professionId }: { query: string; professionId?: string },
        ctx: any
      ) => {
        return professionalService.searchSpecializations(query, professionId);
      },
    },

    Mutation: {
      createProfession: async (_: any, { name }: { name: string }, ctx: any) => {
        const authUserId = ctx.reply.request.user.userId;
        const userProfile = await userProfileService.findByAuthUserId(authUserId);
        if (!userProfile) throw new Error('User profile required');

        return professionalService.createProfession({
          name,
          userId: userProfile.id,
        });
      },

      createSpecialization: async (_: any, { name, professionId }: { name: string; professionId: string }, ctx: any) => {
        const profession = await professionalService.getProfessionById(professionId);
        if (!profession) throw new Error('Profession not found');

        return professionalService.createSpecialization({ name, professionId });
      },
    },

    
  };
}
