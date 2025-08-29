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
import { professionResolvers } from './professions/resolver';
import { professionSchema } from './professions/schema';
import { newsResolvers } from './news/resolver';
import { newsSchema } from './news/schema';
import { searchResolvers } from './search/resolver';
import { searchSchema } from './search/schema';
import { locationSchema } from './locations/schema';
import { locationResolvers } from './locations/resolver';


export function registerGraphql(app: any, db: any) {
  const userRes = userResolvers(app.db);
  const postRes = postResolvers(app.db);
  const commentRes = commentResolvers(app.db);
  const favouriteRes = favouriteResolvers(app.db);
  const businessRes = businessResolvers(app.db);
  const profRes=professionResolvers(app.db)
  const newsRes=newsResolvers(app.db)
  const searchRes=searchResolvers(app.db)
  const locationRes=locationResolvers(app.db)

app.register(mercurius, {
  schema: [userSchema,postSchema,commentSchema,favouriteSchema,businessSchema,professionSchema,newsSchema,searchSchema,locationSchema ],
  resolvers: {
    Query: {
      ...userRes.Query,
      ...postRes.Query,
      ...commentRes.Query,
      ...favouriteRes.Query,
      ...businessRes.Query,
      ...profRes.Query,
      ...newsRes.Query,
      ...searchRes.Query,
      ...locationRes.Query
    },
    Mutation: {
      ...userRes.Mutation,
      ...postRes.Mutation,
      ...commentRes.Mutation,
      ...favouriteRes.Mutation,
      ...businessRes.Mutation,
      ...profRes.Mutation,
      ...newsRes.Mutation,
      ...locationRes.Mutation
    },
  },
  graphiql: true,
  path: "/graphql",
  context: async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      return { user: request.user, db: app.db };
    } catch {
      return { user: null, db: app.db };
    }
  },
});

app.after(() => {
  app.graphql.addHook("preExecution", async (schema, document, context) => {
    const operation = document.definitions[0];
    const opName = operation?.name?.value;

    const publicOps = ["login", "signup", "featuredNews"];

    if (!context.user && !publicOps.includes(opName)) {
      throw new Error("Unauthorized");
    }
  });
});

}
