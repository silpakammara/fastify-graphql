import { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { SessionService } from '../services/sessionService';

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  const sessionService = new SessionService(fastify.db, fastify);

  // List all sessions for current user
  fastify.get('/', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            deviceId: Type.String(),
            deviceName: Type.Optional(Type.String()),
            deviceType: Type.Optional(Type.String()),
            lastActivity: Type.String(),
            expiresAt: Type.String(),
            isActive: Type.Boolean(),
            createdAt: Type.String(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const sessions = await sessionService.getUserSessions(request.user.userId);
    
    return {
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        lastActivity: session.lastActivity.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        isActive: session.isActive,
        createdAt: session.createdAt.toISOString(),
      })),
    };
  });

  // Get active sessions
  fastify.get('/active', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            id: Type.String(),
            deviceId: Type.String(),
            deviceName: Type.Optional(Type.String()),
            deviceType: Type.Optional(Type.String()),
            lastActivity: Type.String(),
            createdAt: Type.String(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const sessions = await sessionService.getActiveSessions(request.user.userId);
    
    return {
      success: true,
      data: sessions.map(session => ({
        id: session.id,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        lastActivity: session.lastActivity.toISOString(),
        createdAt: session.createdAt.toISOString(),
      })),
    };
  });

  // Get current session info
  fastify.get('/current', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            sessionId: Type.String(),
            userId: Type.String(),
            deviceId: Type.String(),
            deviceName: Type.Optional(Type.String()),
            deviceType: Type.Optional(Type.String()),
            lastActivity: Type.String(),
            expiresAt: Type.String(),
            createdAt: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const sessionId = request.headers.authorization?.split(' ')[1]; // Get from token
    
    if (!sessionId) {
      return reply.code(401).send({
        success: false,
        error: 'No session found',
      });
    }

    const session = await sessionService.getSession(sessionId);
    
    if (!session) {
      return reply.code(404).send({
        success: false,
        error: 'Session not found or expired',
      });
    }

    return {
      success: true,
      data: {
        sessionId: session.id,
        userId: session.userId,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        lastActivity: session.lastActivity.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
      },
    };
  });

  // Get all active sessions for current user
  fastify.get('/list', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            sessionId: Type.String(),
            deviceId: Type.String(),
            deviceName: Type.Optional(Type.String()),
            deviceType: Type.Optional(Type.String()),
            ipAddress: Type.Optional(Type.String()),
            lastActivity: Type.String(),
            expiresAt: Type.String(),
            createdAt: Type.String(),
            isCurrent: Type.Boolean(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const currentSessionId = request.headers.authorization?.split(' ')[1];
    const sessions = await sessionService.getUserSessions(request.user!.id);
    
    return {
      success: true,
      data: sessions.map(session => ({
        sessionId: session.id,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        ipAddress: session.ipAddress,
        lastActivity: session.lastActivity.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        isCurrent: session.id === currentSessionId,
      })),
    };
  });

  // Get session statistics
  fastify.get('/stats', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            totalSessions: Type.Integer(),
            activeSessions: Type.Integer(),
            byDeviceType: Type.Record(Type.String(), Type.Integer()),
            recentActivity: Type.Integer(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const stats = await sessionService.getSessionStats(request.user!.id);
    
    return {
      success: true,
      data: stats,
    };
  });

  // Get activity summary
  fastify.get('/activity', {
    preHandler: [fastify.authenticate],
    schema: {
      querystring: Type.Object({
        days: Type.Optional(Type.Integer({ minimum: 1, maximum: 90, default: 7 })),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            dailyActivity: Type.Array(Type.Object({
              date: Type.String(),
              sessionCount: Type.Integer(),
              uniqueDevices: Type.Integer(),
            })),
            mostActiveDevice: Type.Union([
              Type.Object({
                deviceId: Type.String(),
                deviceName: Type.Optional(Type.String()),
                sessionCount: Type.Integer(),
              }),
              Type.Null(),
            ]),
            averageSessionDuration: Type.Integer(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { days = 7 } = request.query;
    const summary = await sessionService.getActivitySummary(request.user!.id, days);
    
    return {
      success: true,
      data: summary,
    };
  });

  // Revoke a specific session
  fastify.delete('/:sessionId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        sessionId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.params;
    const revoked = await sessionService.revokeSession(sessionId, request.user!.id);
    
    if (!revoked) {
      return reply.code(404).send({
        success: false,
        error: 'Session not found or unauthorized',
      });
    }

    return {
      success: true,
      data: {
        message: 'Session revoked successfully',
      },
    };
  });

  // Revoke all other sessions
  fastify.post('/revoke-others', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            revokedCount: Type.Integer(),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const currentSessionId = request.headers.authorization?.split(' ')[1] || '';
    const revokedCount = await sessionService.revokeAllOtherSessions(
      request.user!.id,
      currentSessionId
    );
    
    return {
      success: true,
      data: {
        revokedCount,
        message: `Revoked ${revokedCount} session(s)`,
      },
    };
  });

  // Revoke all sessions (logout everywhere)
  fastify.post('/revoke-all', {
    preHandler: [fastify.authenticate],
    schema: {
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            revokedCount: Type.Integer(),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const revokedCount = await sessionService.revokeAllSessions(request.user!.id);
    
    return {
      success: true,
      data: {
        revokedCount,
        message: `Revoked all ${revokedCount} session(s)`,
      },
    };
  });

  // Extend current session
  fastify.post('/extend', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        hours: Type.Integer({ minimum: 1, maximum: 168 }), // Max 1 week
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            expiresAt: Type.String(),
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const sessionId = request.headers.authorization?.split(' ')[1];
    
    if (!sessionId) {
      return reply.code(401).send({
        success: false,
        error: 'No session found',
      });
    }

    const { hours } = request.body;
    const session = await sessionService.extendSession(sessionId, hours);
    
    if (!session) {
      return reply.code(404).send({
        success: false,
        error: 'Session not found or inactive',
      });
    }

    return {
      success: true,
      data: {
        expiresAt: session.expiresAt.toISOString(),
        message: `Session extended by ${hours} hour(s)`,
      },
    };
  });

  // Update session device info
  fastify.put('/device', {
    preHandler: [fastify.authenticate],
    schema: {
      body: Type.Object({
        deviceName: Type.Optional(Type.String()),
        deviceType: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Object({
            message: Type.String(),
          }),
        }),
      },
    },
  }, async (request, reply) => {
    const sessionId = request.headers.authorization?.split(' ')[1];
    
    if (!sessionId) {
      return reply.code(401).send({
        success: false,
        error: 'No session found',
      });
    }

    const session = await sessionService.updateSessionDevice(sessionId, request.body);
    
    if (!session) {
      return reply.code(404).send({
        success: false,
        error: 'Session not found or inactive',
      });
    }

    return {
      success: true,
      data: {
        message: 'Device info updated successfully',
      },
    };
  });

  // Get sessions for a specific device
  fastify.get('/device/:deviceId', {
    preHandler: [fastify.authenticate],
    schema: {
      params: Type.Object({
        deviceId: Type.String(),
      }),
      response: {
        200: Type.Object({
          success: Type.Boolean(),
          data: Type.Array(Type.Object({
            sessionId: Type.String(),
            lastActivity: Type.String(),
            expiresAt: Type.String(),
            createdAt: Type.String(),
          })),
        }),
      },
    },
  }, async (request, reply) => {
    const { deviceId } = request.params;
    const sessions = await sessionService.getDeviceSessions(request.user!.id, deviceId);
    
    return {
      success: true,
      data: sessions.map(session => ({
        sessionId: session.id,
        lastActivity: session.lastActivity.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
      })),
    };
  });
};

export default sessionRoutes;