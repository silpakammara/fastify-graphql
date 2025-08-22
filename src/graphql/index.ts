import mercurius from 'mercurius';
import { userSchema } from './users/schema';
import { userResolvers } from './users/resolvers';

export function registerGraphql(app: any, db: any) {
  app.register(mercurius, {
    schema: userSchema,
    resolvers: userResolvers(app.db),
    graphiql: true,
    path: "/graphql",
    context: async (request:any, reply:any) => {
    try {
      await request.jwtVerify(); 
      return { user: request.user };
    } catch (err) {
      return { user: null };
    }
  }
  });
}
