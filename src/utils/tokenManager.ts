import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  expiresAt: Date;
}

// In-memory storage for refresh tokens (in production, use Redis or database)
const refreshTokenStore = new Map<string, RefreshTokenData>();

export class TokenManager {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Generate access and refresh tokens
   */
  generateTokenPair(userId: string, email: string): TokenPair {
    // Generate access token (short-lived)
    const accessToken = this.fastify.jwt.sign(
      { userId, email },
      { expiresIn: '1h' } // 1 hour
    );

    // Generate refresh token (long-lived)
    const tokenId = randomBytes(32).toString('hex');
    const refreshToken = this.fastify.jwt.sign(
      { userId, tokenId, type: 'refresh' },
      { expiresIn: '30d' } // 30 days
    );

    // Store refresh token data
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    refreshTokenStore.set(tokenId, {
      userId,
      tokenId,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify and refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair | null> {
    try {
      // Verify refresh token
      const decoded = this.fastify.jwt.verify(refreshToken) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if refresh token exists in store
      const tokenData = refreshTokenStore.get(decoded.tokenId);
      if (!tokenData) {
        throw new Error('Refresh token not found');
      }

      // Check if refresh token is expired
      if (new Date() > tokenData.expiresAt) {
        refreshTokenStore.delete(decoded.tokenId);
        throw new Error('Refresh token expired');
      }

      // Verify user ID matches
      if (tokenData.userId !== decoded.userId) {
        throw new Error('Invalid refresh token');
      }

      // Get user from database to ensure they still exist
      const { authUsers } = await import('../models/authUser');
      const { eq } = await import('drizzle-orm');
      
      const [authUser] = await this.fastify.db
        .select()
        .from(authUsers)
        .where(eq(authUsers.id, decoded.userId))
        .limit(1);

      if (!authUser) {
        throw new Error('User not found');
      }

      // Generate new token pair
      const newTokens = this.generateTokenPair(authUser.id, authUser.email);

      // Revoke old refresh token
      refreshTokenStore.delete(decoded.tokenId);

      return newTokens;
    } catch (error) {
      this.fastify.log.error('Refresh token error:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   */
  revokeRefreshToken(tokenId: string): boolean {
    return refreshTokenStore.delete(tokenId);
  }

  /**
   * Revoke all refresh tokens for a user
   */
  revokeAllUserTokens(userId: string): void {
    for (const [tokenId, data] of refreshTokenStore.entries()) {
      if (data.userId === userId) {
        refreshTokenStore.delete(tokenId);
      }
    }
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [tokenId, data] of refreshTokenStore.entries()) {
      if (now > data.expiresAt) {
        refreshTokenStore.delete(tokenId);
      }
    }
  }
}