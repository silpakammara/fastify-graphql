import { JWT } from '@fastify/jwt';
import { User } from '../models/user';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      HOST: string;
      NODE_ENV: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;
      GOOGLE_CLIENT_ID: string;
      APPLE_CLIENT_ID: string;
      APPLE_TEAM_ID: string;
      APPLE_KEY_ID: string;
      CORS_ORIGIN: string;
      CLOUDFLARE_ACCOUNT_ID: string;
      CLOUDFLARE_IMAGES_API_TOKEN: string;
      CLOUDFLARE_IMAGES_ACCOUNT_HASH: string;
    };
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: User;
  }
}