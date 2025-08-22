import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJWT from '@fastify/jwt';
import { user } from '../models/user';
import { authUsers } from '../models/authUser';
import { eq } from 'drizzle-orm';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: {
      userId: string;
      email: string;
      authUser?: any;
      profile?: any;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJWT, {
    secret: fastify.config.JWT_SECRET,
    sign: {
      expiresIn: fastify.config.JWT_EXPIRES_IN,
    },
  });

  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
      
      const userId = request.user.userId;
      
      // Single optimized query with left join to get both auth user and profile
      const [result] = await fastify.db
        .select({
          authUser: authUsers,
          profile: user,
        })
        .from(authUsers)
        .leftJoin(user, eq(user.userAuthId, authUsers.id))
        .where(eq(authUsers.id, userId))
        .limit(1);

      if (!result || !result.authUser) {
        return reply.code(401).send({
          success: false,
          error: 'User not found',
        });
      }

      // Store both auth and profile info
      request.user = {
        ...request.user,
        authUser: result.authUser,
        profile: result.profile || null,
      };
    } catch (err) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid token',
      });
    }
  });
};

export default fp(authPlugin, {
  name: 'auth',
  dependencies: ['env', 'db'],
});