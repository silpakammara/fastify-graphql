import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import envPlugin from './plugins/env';
import dbPlugin from './plugins/db';
import authPlugin from './plugins/auth';
import { sql } from 'drizzle-orm';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import businessRoutes from './routes/businesses';
import postRoutes from './routes/posts';
import commentRoutes from './routes/comments';
import favouriteRoutes from './routes/favourites';
import locationRoutes from './routes/locations';
import professionRoutes from './routes/professions';
import newsRoutes from './routes/news';
import searchRoutes from './routes/search';
import analyticsRoutes from './routes/analytics';
import mediaRoutes from './routes/media';
import adminMediaRoutes from './routes/admin/media';
import sessionRoutes from './routes/sessions';
import userMediaRoutes from './routes/users-media';
import postsMediaRoutes from './routes/posts-media';
import businessMediaRoutes from './routes/business-media';
import { registerGraphql } from './graphql';




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

  // Register env plugin first
  await fastify.register(envPlugin);


  // registerGraphql(fastify, fastify.db);
//   fastify.listen({ port: 3000 }, (err, address) => {
//     if (err) throw err;
//   console.log(`🚀 Server ready at ${address}/graphiql`);
// });
  
 
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow all origins in development
      if (fastify.config.NODE_ENV === 'development') {
        cb(null, true);
      } else {
        // In production, check against allowed origins
        const allowed = fastify.config.CORS_ORIGIN === '*' || fastify.config.CORS_ORIGIN === origin;
        cb(null, allowed);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Fastify Auth API',
        description: 'Secure API backend with Google and Apple authentication',
        version: '1.0.0',
      },
      servers: [
        {
          url: fastify.config.NODE_ENV === 'production' 
            ? 'https://api.yourdomain.com'
            : `http://localhost:${fastify.config.PORT}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });


 


  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      tryItOutEnabled: true,
    },
    staticCSP: false,
    transformStaticCSP: (header) => header,
  });

  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);
  registerGraphql(fastify, fastify.db);

  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(businessRoutes, { prefix: '/api/businesses' });
  await fastify.register(postRoutes, { prefix: '/api/posts' });
  await fastify.register(commentRoutes, { prefix: '/api' });
  await fastify.register(favouriteRoutes, { prefix: '/api/favourites' });
  await fastify.register(locationRoutes, { prefix: '/api/locations' });
  await fastify.register(professionRoutes, { prefix: '/api/professions' });
  await fastify.register(newsRoutes, { prefix: '/api/news' });
  await fastify.register(searchRoutes, { prefix: '/api/search' });
  await fastify.register(analyticsRoutes, { prefix: '/api/analytics' });
  await fastify.register(mediaRoutes, { prefix: '/api/media' });
  await fastify.register(adminMediaRoutes, { prefix: '/api/admin/media' });
  await fastify.register(sessionRoutes, { prefix: '/api/sessions' });
  await fastify.register(userMediaRoutes, { prefix: '/api/users/media' });
  await fastify.register(postsMediaRoutes, { prefix: '/api/posts' });
  await fastify.register(businessMediaRoutes,{prefix:'/api/business/media'})

  fastify.get('/', async () => {
    return {
      success: true,
      data: {
        message: 'Fastify Auth API',
        version: '1.0.0',
        docs: '/docs',
      },
    };
  });

  fastify.get('/health', async () => {
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
  });

  // Warmup endpoint to pre-establish database connections
  fastify.get('/warmup', async () => {
    try {
      // Execute a simple query to warm up the connection pool
      await fastify.db.execute(sql`SELECT 1`);
      
      return {
        success: true,
        data: {
          status: 'warmed up',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Warmup failed',
      };
    }
  });

  return fastify;
}


async function start() {
  const fastify = await buildApp();
  
  try {
    await fastify.listen({
      port: fastify.config.PORT,
      host: fastify.config.HOST,
    });
    
    fastify.log.info(`Server listening on ${fastify.config.HOST}:${fastify.config.PORT}`);
    fastify.log.info(`API Documentation available at http://localhost:${fastify.config.PORT}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildApp };