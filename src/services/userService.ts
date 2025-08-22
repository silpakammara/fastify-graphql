import { eq, and } from 'drizzle-orm';
import { authUsers, type AuthUser, type NewAuthUser } from '../models/authUser';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { withRetry } from '../utils/dbRetry';

export class UserService {
  constructor(private db: NodePgDatabase<typeof import('../models/authUser')>) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const [user] = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);
    
    return user || null;
  }

  async findByProviderId(provider: 'google' | 'apple', providerId: string): Promise<AuthUser | null> {
    return withRetry(async () => {
      const [user] = await this.db
        .select()
        .from(authUsers)
        .where(and(eq(authUsers.provider, provider), eq(authUsers.providerId, providerId)))
        .limit(1);
      
      return user || null;
    });
  }

  async upsertFromProvider(userData: {
    email: string;
    name: string;
    provider: 'google' | 'apple';
    providerId: string;
    avatar?: string;
  }): Promise<{ user: AuthUser; isNewUser: boolean }> {
    // First check by provider ID
    let existingUser = await this.findByProviderId(userData.provider, userData.providerId);
    
    // If not found by provider ID, check by email
    if (!existingUser) {
      existingUser = await this.findByEmail(userData.email);
    }
    
    if (existingUser) {
      // Only update fields that might have changed
      const updates: any = {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Update provider info if user exists with email but different provider
      if (!existingUser.providerId || existingUser.provider !== userData.provider) {
        updates.provider = userData.provider;
        updates.providerId = userData.providerId;
      }
      
      // Update avatar if it has changed
      if (userData.avatar && userData.avatar !== existingUser.avatar) {
        updates.avatar = userData.avatar;
      }
      
      // Update name if it has changed
      if (userData.name && userData.name !== existingUser.name) {
        updates.name = userData.name;
      }
      
      const [updatedUser] = await this.db
        .update(authUsers)
        .set(updates)
        .where(eq(authUsers.id, existingUser.id))
        .returning();
      
      return { user: updatedUser!, isNewUser: false };
    }

    // Create new user
    const [newUser] = await this.db
      .insert(authUsers)
      .values({
        email: userData.email,
        name: userData.name,
        provider: userData.provider,
        providerId: userData.providerId,
        avatar: userData.avatar,
        isActive: true,
        emailVerified: true, // OAuth providers verify emails
        lastLoginAt: new Date(),
      })
      .returning();
    
    return { user: newUser!, isNewUser: true };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const [user] = await this.db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, id))
      .limit(1);
    
    return user || null;
  }
}