import { FastifyPluginAsync } from 'fastify';
import { UserService } from '../services/userService';
import { verifyGoogleToken, verifyAppleToken } from '../utils/tokenValidation';
import { GoogleAuthBody, AppleAuthBody, type AuthResponse } from '../types/auth';
import { TokenManager } from '../utils/tokenManager';
import { OAuth2Client } from 'google-auth-library';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  const userService = new UserService(fastify.db);
  const tokenManager = new TokenManager(fastify);
  
  // Initialize Google OAuth2 client for web flow
  const googleOAuth2Client = new OAuth2Client(
    fastify.config.GOOGLE_CLIENT_ID,
    fastify.config.GOOGLE_CLIENT_SECRET,
    `${fastify.config.API_URL}/auth/google/callback`
  );

  // Test endpoint - no auth required
  fastify.get('/test', async (request, reply) => {
    return reply.code(200).send({
      success: true,
      data: {
        message: 'Auth API is working!',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Google OAuth - Direct token validation (for native apps)
  fastify.post<{ Body: { idToken: string } }>(
    '/auth/google',
    {
      schema: {
        body: GoogleAuthBody,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                    },
                  },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      avatar: { type: 'string', nullable: true },
                    },
                  },
                  isNewUser: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { idToken } = request.body;
        
        const payload = await verifyGoogleToken(idToken, fastify.config.GOOGLE_CLIENT_ID);
        
        const { user, isNewUser } = await userService.upsertFromProvider({
          email: payload.email!,
          name: payload.name || payload.given_name || 'User',
          provider: 'google',
          providerId: payload.sub,
          avatar: payload.picture,
        });

        const tokens = tokenManager.generateTokenPair(user.id, user.email);

        const response = {
          success: true,
          data: {
            tokens,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatar: user.avatar || undefined,
            },
            isNewUser,
          },
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    }
  );

  // Google OAuth - Mobile web flow
  fastify.get<{ Querystring: { redirect?: string } }>(
    '/auth/google/mobile',
    async (request, reply) => {
      try {
        const { redirect = 'sarvail://auth' } = request.query;
        
        console.log('Mobile OAuth initiated with redirect:', redirect);
        
        // Store redirect URI in session or state parameter
        const state = Buffer.from(JSON.stringify({ redirect })).toString('base64');
        
        const authUrl = googleOAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['profile', 'email'],
          state,
          prompt: 'consent',
        });

        return reply.redirect(authUrl);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Failed to initiate OAuth flow',
        });
      }
    }
  );

  // Google OAuth callback
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/auth/google/callback',
    async (request, reply) => {
      try {
        const { code, state, error } = request.query;

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        // Parse state to get redirect URI
        const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
        let redirectUri = stateData.redirect || 'sarvail://auth';
        
        // Handle Expo development URLs (exp://...)
        if (redirectUri.includes('exp://') || redirectUri.includes('exp+sarvail://')) {
          // Keep the original redirect URI for Expo
          console.log('Using Expo redirect URI:', redirectUri);
        }

        // Exchange code for tokens
        const { tokens } = await googleOAuth2Client.getToken(code);
        const idToken = tokens.id_token;

        if (!idToken) {
          throw new Error('No ID token received');
        }

        // Verify and decode the ID token
        const ticket = await googleOAuth2Client.verifyIdToken({
          idToken,
          audience: fastify.config.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        if (!payload) {
          throw new Error('Invalid ID token payload');
        }

        // Create or update user
        const { user, isNewUser } = await userService.upsertFromProvider({
          email: payload.email!,
          name: payload.name || payload.given_name || 'User',
          provider: 'google',
          providerId: payload.sub,
          avatar: payload.picture,
        });

        // Generate tokens
        const tokenPair = tokenManager.generateTokenPair(user.id, user.email);

        // Redirect back to app with tokens
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.append('access_token', tokenPair.accessToken);
        redirectUrl.searchParams.append('refresh_token', tokenPair.refreshToken);
        redirectUrl.searchParams.append('is_new_user', isNewUser.toString());

        return reply.redirect(redirectUrl.toString());
      } catch (error) {
        fastify.log.error(error);
        
        // Redirect with error
        const redirectUri = 'sarvail://auth';
        const redirectUrl = new URL(redirectUri);
        redirectUrl.searchParams.append('error', error instanceof Error ? error.message : 'Authentication failed');
        
        return reply.redirect(redirectUrl.toString());
      }
    }
  );

  // Apple OAuth
  fastify.post<{ Body: { identityToken: string; user?: { email?: string; fullName?: any } } }>(
    '/auth/apple',
    {
      schema: {
        body: {
          type: 'object',
          required: ['identityToken'],
          properties: {
            identityToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                fullName: {
                  type: 'object',
                  properties: {
                    givenName: { type: 'string' },
                    familyName: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { identityToken, user: appleUser } = request.body;
        
        const payload = await verifyAppleToken(identityToken, fastify.config.APPLE_CLIENT_ID);
        
        // Apple only provides user info on first sign-in
        let name = 'User';
        if (appleUser?.fullName) {
          const { givenName, familyName } = appleUser.fullName;
          name = [givenName, familyName].filter(Boolean).join(' ') || 'User';
        } else if (payload.email) {
          name = payload.email.split('@')[0];
        }

        const { user, isNewUser } = await userService.upsertFromProvider({
          email: payload.email || appleUser?.email || `${payload.sub}@privaterelay.appleid.com`,
          name,
          provider: 'apple',
          providerId: payload.sub,
        });

        const tokens = tokenManager.generateTokenPair(user.id, user.email);

        const response = {
          success: true,
          data: {
            tokens,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              avatar: user.avatar || undefined,
            },
            isNewUser,
          },
        };

        return reply.code(200).send(response);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        });
      }
    }
  );

  // Refresh token endpoint
  fastify.post<{ Body: { refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { refreshToken } = request.body;
        
        const tokens = await tokenManager.refreshAccessToken(refreshToken);
        
        if (!tokens) {
          return reply.code(401).send({
            success: false,
            error: 'Invalid or expired refresh token',
          });
        }

        return reply.code(200).send({
          success: true,
          data: { tokens },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(401).send({
          success: false,
          error: 'Token refresh failed',
        });
      }
    }
  );

  // Logout endpoint
  fastify.post(
    '/auth/logout',
    {
      onRequest: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        // Revoke all refresh tokens for this user
        tokenManager.revokeAllUserTokens(request.user.userId);
        
        return reply.code(200).send({
          success: true,
          data: {
            message: 'Logged out successfully',
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'Logout failed',
        });
      }
    }
  );

  // Get current user
  fastify.get(
    '/me',
    {
      onRequest: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            include: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      avatar: { type: 'string', nullable: true },
                      emailVerified: { type: 'boolean' },
                      provider: { type: 'string' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                  },
                  profile: {
                    type: 'object',
                    nullable: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = request.user.authUser;
      const profile = request.user.profile;
      const includeProfile = request.query.include === 'profile';
      
      const response: any = {
        success: true,
        data: {
          user: {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            avatar: authUser.avatar || undefined,
            emailVerified: authUser.emailVerified || false,
            provider: authUser.provider,
            createdAt: authUser.createdAt ? new Date(authUser.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: authUser.updatedAt ? new Date(authUser.updatedAt).toISOString() : new Date().toISOString(),
          },
        },
      };

      if (includeProfile && profile) {
        response.data.profile = profile;
      }

      return reply.code(200).send(response);
    }
  );
};

export default authRoutes;