import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import fastifyEnv from '@fastify/env';

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'JWT_SECRET'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    NODE_ENV: {
      type: 'string',
      default: 'development',
    },
    API_URL: {
      type: 'string',
      default: 'http://localhost:3000/api',
    },
    DATABASE_URL: {
      type: 'string',
    },
    JWT_SECRET: {
      type: 'string',
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '7d',
    },
    GOOGLE_CLIENT_ID: {
      type: 'string',
      default: '',
    },
    GOOGLE_CLIENT_SECRET: {
      type: 'string',
      default: '',
    },
    APPLE_CLIENT_ID: {
      type: 'string',
      default: '',
    },
    APPLE_TEAM_ID: {
      type: 'string',
      default: '',
    },
    APPLE_KEY_ID: {
      type: 'string',
      default: '',
    },
    CORS_ORIGIN: {
      type: 'string',
      default: '*',
    },
    CLOUDFLARE_ACCOUNT_ID: {
      type: 'string',
      default: '',
    },
    CLOUDFLARE_IMAGES_API_TOKEN: {
      type: 'string',
      default: '',
    },
    CLOUDFLARE_IMAGES_ACCOUNT_HASH: {
      type: 'string',
      default: '',
    },
  },
};

const envPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true,
  });
};

export default fp(envPlugin, {
  name: 'env',
});