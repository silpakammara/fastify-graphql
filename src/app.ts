import Fastify from 'fastify';
import envPlugin from './plugins/env';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import { sql } from 'drizzle-orm';
import { registerGraphql } from './graphql';


// Build Fastify with GraphQL only
async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });


  // Register GraphQL
    await fastify.register(envPlugin);
    await fastify.register(dbPlugin);
    await fastify.register(authPlugin);
    registerGraphql(fastify, fastify.db);

  fastify.get('/', async () => ({
    message: '🚀 GraphQL Server running',
    graphql: '/graphql',
  }));

  return fastify;
}
async function start() {
  const fastify = await buildApp();

  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' });
    fastify.log.info(`🚀 GraphQL API ready at http://localhost:4000/graphql`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildApp };
