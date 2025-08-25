import mercurius from 'mercurius';
import { userSchema } from './users/schema';
import { userResolvers } from './users/resolvers';
import { postSchema } from './posts/schema';
import { postResolvers } from './posts/resolver';

export function registerGraphql(app: any, db: any) {
  const userRes = userResolvers(app.db);
  const postRes = postResolvers(app.db);

  app.register(mercurius, {
    schema: [userSchema, postSchema],
    resolvers: {
      Query: {
        ...userRes.Query,
        ...postRes.Query,
      },
      Mutation: {
        ...userRes.Mutation,
        ...postRes.Mutation,
      },
    },
    graphiql: true,
    path: "/graphql",
    context: async (request: any, reply: any) => {
      try {
        await request.jwtVerify();
        return { user: request.user };
      } catch (err) {
        return { user: null };
      }
    },
  });
}
