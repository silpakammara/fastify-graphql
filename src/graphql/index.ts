import mercurius from 'mercurius';
import { userSchema } from './users/schema';
import { userResolvers } from './users/resolvers';
import { postSchema } from './posts/schema';
import { postResolvers } from './posts/resolver';
import { commentResolvers } from './comments/resolver';
import { commentSchema } from './comments/schema';
import { favouriteResolvers } from './favourites/resolver';
import { favouriteSchema } from './favourites/schema';
import { businessResolvers } from './business/resolver';
import { businessSchema } from './business/schema';

export function registerGraphql(app: any, db: any) {
  const userRes = userResolvers(app.db);
  const postRes = postResolvers(app.db);
  const commentRes = commentResolvers(app.db);
  const favouriteRes = favouriteResolvers(app.db);
  const businessRes = businessResolvers(app.db);

  app.register(mercurius, {
    schema: [userSchema, postSchema, commentSchema, favouriteSchema, businessSchema],
    resolvers: {
      Query: {
        ...userRes.Query,
        ...postRes.Query,
        ...commentRes.Query,
        ...favouriteRes.Query,
        ...businessRes.Query,
      },
      Mutation: {
        ...userRes.Mutation,
        ...postRes.Mutation,
        ...commentRes.Mutation,
        ...favouriteRes.Mutation,
        ...businessRes.Mutation,
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
