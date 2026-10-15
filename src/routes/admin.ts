import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { notifyAdminNewOrder } from '../services/notifications';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/admin/orders', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { page = '0', limit = '20', status, region } = request.query as Record<string, string>;
    const skip = parseInt(page) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = {};
    if (status) where.status = status;
    if (region) where.region = region;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.order.count({ where }),
    ]);

    return { orders, total, page: parseInt(page), pages: Math.ceil(total / take) };
  });

  app.patch('/api/admin/orders/:id', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, adminNote } = request.body as { status: string; adminNote?: string };

    const order = await prisma.order.update({
      where: { id },
      data: { status: status as any, adminNote },
    });

    if (status === 'COMPLETED' && adminNote) {
      const { notifyUserOrderConfirmed } = await import('../services/notifications.js');
      await notifyUserOrderConfirmed(id, adminNote);
    } else if (status === 'REJECTED' && adminNote) {
      const { notifyUserOrderRejected } = await import('../services/notifications.js');
      await notifyUserOrderRejected(id, adminNote);
    }

    return order;
  });

  app.get('/api/admin/regions', { preHandler: adminAuthMiddleware }, async () => {
    return prisma.regionConfig.findMany();
  });

  app.patch('/api/admin/regions/:code', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { code } = request.params as { code: string };
    const { rateToBYN, denominations } = request.body as { rateToBYN?: number; denominations?: any[] };

    return prisma.regionConfig.update({
      where: { code },
      data: { rateToBYN, denominations },
    });
  });

  app.get('/api/admin/credentials', { preHandler: adminAuthMiddleware }, async () => {
    return prisma.paymentCredentials.findUnique({ where: { id: 'singleton' } }) || {};
  });

  app.patch('/api/admin/credentials', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { cardNumber, eripPath, usdtAddress } = request.body as any;
    return prisma.paymentCredentials.upsert({
      where: { id: 'singleton' },
      create: { cardNumber, eripPath, usdtAddress },
      update: { cardNumber, eripPath, usdtAddress },
    });
  });

  app.get('/api/admin/games', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { page = '0', limit = '20', search, autoSynced } = request.query as Record<string, string>;
    const skip = parseInt(page) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = {};
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (autoSynced !== undefined) where.isAutoSynced = autoSynced === 'true';

    const [games, total] = await Promise.all([
      prisma.game.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
      prisma.game.count({ where }),
    ]);

    return { games, total, page: parseInt(page), pages: Math.ceil(total / take) };
  });

  app.post('/api/admin/games', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const data = request.body as any;
    return prisma.game.create({ data: { ...data, isAutoSynced: false } });
  });

  app.patch('/api/admin/games/:id', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    return prisma.game.update({ where: { id }, data: { ...data, isAutoSynced: false } });
  });

  app.post('/api/admin/games/sync', { preHandler: adminAuthMiddleware }, async (request, reply) => {
    const { syncBestsellers } = await import('../services/parser.js');
    await syncBestsellers();
    return { ok: true };
  });
}