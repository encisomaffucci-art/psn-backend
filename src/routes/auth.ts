import { FastifyInstance } from 'fastify';
import { validateTelegramLoginWidget } from '../utils/hmac';
import { prisma } from '../prisma';
import { config } from '../config';

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/admin/auth/telegram', async (request, reply) => {
    const authData = request.body as Record<string, string>;
    
    if (!validateTelegramLoginWidget(authData)) {
      return reply.code(401).send({ error: 'Invalid auth data' });
    }

    if (authData.id !== config.ADMIN_ID) {
      return reply.code(403).send({ error: 'Not admin' });
    }

    const accessToken = app.jwt.sign({ userId: authData.id, role: 'admin' }, { expiresIn: '15m' });
    const refreshToken = app.jwt.sign({ userId: authData.id, type: 'refresh' }, { expiresIn: '7d' });

    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return { accessToken };
  });

  app.post('/api/admin/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken as string | undefined;
    if (!refreshToken) return reply.code(401).send({ error: 'No refresh token' });

    try {
      const decoded = app.jwt.verify(refreshToken) as { userId: string; type: string };
      if (decoded.type !== 'refresh') throw new Error('Invalid token type');
      if (decoded.userId !== config.ADMIN_ID) return reply.code(403).send({ error: 'Not admin' });

      const accessToken = app.jwt.sign({ userId: decoded.userId, role: 'admin' }, { expiresIn: '15m' });
      return { accessToken };
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });
}