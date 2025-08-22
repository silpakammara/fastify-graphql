import { eq, and, desc, gte, or } from 'drizzle-orm';
import { authUsers } from '../models/authUser';
import { user } from '../models/user';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class SessionService {
  // In-memory session storage (in production, use Redis or similar)
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  constructor(
    private db: NodePgDatabase<any>,
    private fastify: FastifyInstance
  ) {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: string,
    deviceInfo: DeviceInfo,
    expiryHours: number = 24
  ): Promise<Session> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const session: Session = {
      id: sessionId,
      userId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      deviceType: deviceInfo.deviceType,
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      lastActivity: now,
      expiresAt,
      isActive: true,
      createdAt: now,
    };

    // Store session
    this.sessions.set(sessionId, session);

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);

    // Update last login in database
    await this.db
      .update(authUsers)
      .set({ lastLoginAt: now })
      .where(eq(authUsers.id, userId));

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return null;
    }

    // Update last activity
    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    const activeSessions: Session[] = [];
    const now = new Date();

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && session.isActive && session.expiresAt > now) {
        activeSessions.push(session);
      }
    }

    return activeSessions.sort((a, b) => 
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.getUserSessions(userId);
  }

  /**
   * Get session count by device type
   */
  async getSessionStats(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    byDeviceType: Record<string, number>;
    recentActivity: number;
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    let sessions: Session[] = [];
    
    if (userId) {
      sessions = await this.getUserSessions(userId);
    } else {
      // Get all sessions
      sessions = Array.from(this.sessions.values()).filter(
        s => s.isActive && s.expiresAt > now
      );
    }

    const byDeviceType: Record<string, number> = {};
    let recentActivity = 0;

    sessions.forEach(session => {
      const type = session.deviceType || 'unknown';
      byDeviceType[type] = (byDeviceType[type] || 0) + 1;
      
      if (session.lastActivity > oneHourAgo) {
        recentActivity++;
      }
    });

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.lastActivity > oneHourAgo).length,
      byDeviceType,
      recentActivity,
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.userId !== userId) {
      return false;
    }

    session.isActive = false;
    this.sessions.set(sessionId, session);
    
    const userSessionIds = this.userSessions.get(userId);
    if (userSessionIds) {
      userSessionIds.delete(sessionId);
    }

    return true;
  }

  /**
   * Revoke all sessions for a user except the current one
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return 0;

    let revokedCount = 0;

    for (const sessionId of sessionIds) {
      if (sessionId !== currentSessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.isActive) {
          session.isActive = false;
          this.sessions.set(sessionId, session);
          revokedCount++;
        }
      }
    }

    return revokedCount;
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string): Promise<number> {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return 0;

    let revokedCount = 0;

    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session && session.isActive) {
        session.isActive = false;
        this.sessions.set(sessionId, session);
        revokedCount++;
      }
    }

    this.userSessions.delete(userId);
    return revokedCount;
  }

  /**
   * Extend session expiry
   */
  async extendSession(sessionId: string, additionalHours: number): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return null;
    }

    const now = new Date();
    session.expiresAt = new Date(
      Math.max(session.expiresAt.getTime(), now.getTime()) + 
      additionalHours * 60 * 60 * 1000
    );
    session.lastActivity = now;
    
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get device-specific sessions
   */
  async getDeviceSessions(userId: string, deviceId: string): Promise<Session[]> {
    const userSessions = await this.getUserSessions(userId);
    return userSessions.filter(s => s.deviceId === deviceId);
  }

  /**
   * Update session device info
   */
  async updateSessionDevice(
    sessionId: string,
    deviceInfo: Partial<DeviceInfo>
  ): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      return null;
    }

    if (deviceInfo.deviceName !== undefined) session.deviceName = deviceInfo.deviceName;
    if (deviceInfo.deviceType !== undefined) session.deviceType = deviceInfo.deviceType;
    if (deviceInfo.userAgent !== undefined) session.userAgent = deviceInfo.userAgent;
    if (deviceInfo.ipAddress !== undefined) session.ipAddress = deviceInfo.ipAddress;
    
    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Check if user has active sessions
   */
  async hasActiveSessions(userId: string): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length > 0;
  }

  /**
   * Get session activity summary
   */
  async getActivitySummary(userId: string, days: number = 7): Promise<{
    dailyActivity: Array<{ date: string; sessionCount: number; uniqueDevices: number }>;
    mostActiveDevice: { deviceId: string; deviceName?: string; sessionCount: number } | null;
    averageSessionDuration: number;
  }> {
    const sessions = await this.getUserSessions(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Group sessions by date
    const dailyActivity: Record<string, { sessions: Set<string>; devices: Set<string> }> = {};
    const deviceActivity: Record<string, number> = {};

    sessions.forEach(session => {
      if (session.createdAt >= cutoffDate) {
        const dateKey = session.createdAt.toISOString().split('T')[0];
        
        if (!dailyActivity[dateKey]) {
          dailyActivity[dateKey] = { sessions: new Set(), devices: new Set() };
        }
        
        dailyActivity[dateKey].sessions.add(session.id);
        dailyActivity[dateKey].devices.add(session.deviceId);
        
        deviceActivity[session.deviceId] = (deviceActivity[session.deviceId] || 0) + 1;
      }
    });

    // Convert to array format
    const dailyActivityArray = Object.entries(dailyActivity)
      .map(([date, data]) => ({
        date,
        sessionCount: data.sessions.size,
        uniqueDevices: data.devices.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Find most active device
    let mostActiveDevice = null;
    let maxActivity = 0;
    
    for (const [deviceId, count] of Object.entries(deviceActivity)) {
      if (count > maxActivity) {
        maxActivity = count;
        const deviceSession = sessions.find(s => s.deviceId === deviceId);
        mostActiveDevice = {
          deviceId,
          deviceName: deviceSession?.deviceName,
          sessionCount: count,
        };
      }
    }

    // Calculate average session duration (in minutes)
    const sessionDurations = sessions.map(session => {
      const duration = session.lastActivity.getTime() - session.createdAt.getTime();
      return duration / (1000 * 60); // Convert to minutes
    });
    
    const averageSessionDuration = sessionDurations.length > 0
      ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
      : 0;

    return {
      dailyActivity: dailyActivityArray,
      mostActiveDevice,
      averageSessionDuration,
    };
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (!session.isActive || session.expiresAt < now) {
        this.sessions.delete(sessionId);
        
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
          userSessionIds.delete(sessionId);
          if (userSessionIds.size === 0) {
            this.userSessions.delete(session.userId);
          }
        }
        
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.fastify.log.info(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Generate a secure session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }
}