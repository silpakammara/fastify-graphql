import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as authUserSchema from '../models/authUser';
import * as userSchema from '../models/user';
import * as mediaSchema from '../models/media';
import * as countriesSchema from '../models/countries';
import * as statesSchema from '../models/states';
import * as citiesSchema from '../models/cities';
import * as professionsSchema from '../models/professions';
import * as specializationSchema from '../models/specialization';
import * as businessDetailsSchema from '../models/business_details';
import * as postUpdatesSchema from '../models/post_updates';
import * as commentsSchema from '../models/comments';
import * as commentRepliesSchema from '../models/comment_replies';
import * as newsSchema from '../models/news';
import * as favouritesSchema from '../models/favourites';
import * as relations from '../models/relations';

const schema = { 
  ...authUserSchema, 
  ...userSchema,
  ...mediaSchema,
  ...countriesSchema,
  ...statesSchema,
  ...citiesSchema,
  ...professionsSchema,
  ...specializationSchema,
  ...businessDetailsSchema,
  ...postUpdatesSchema,
  ...commentsSchema,
  ...commentRepliesSchema,
  ...newsSchema,
  ...favouritesSchema,
  ...relations,
};

declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle>;
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  const pool = new Pool({
    connectionString: fastify.config.DATABASE_URL,
    ssl: fastify.config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    // Optimize connection pool settings
    max: 20, // Maximum number of clients in the pool
    min: 5,  // Minimum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 5000, // Increased to 5 seconds for better stability
    // Enable statement caching for better performance
    statement_timeout: 30000, // 30 second statement timeout
    query_timeout: 30000,
    // Additional stability settings
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  // Enhanced pool event handling
  pool.on('connect', (client) => {
    fastify.log.debug('Database connection established');
    // Set search_path if needed
    client.query('SET search_path TO public');
  });
  
  pool.on('error', (err, client) => {
    fastify.log.error('Database pool error:', err);
    // Don't exit on pool errors, let the pool handle reconnection
  });
  
  pool.on('remove', () => {
    fastify.log.debug('Client removed from pool');
  });
  
  // Test the connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    fastify.log.info('Database connection test successful');
  } catch (err) {
    fastify.log.error('Database connection test failed:', err);
    throw err;
  }

  const db = drizzle(pool, { 
    schema,
    logger: fastify.config.NODE_ENV === 'development' // Enable query logging in development
  });

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
};

export default fp(dbPlugin, {
  name: 'db',
  dependencies: ['env'],
});