import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { initDataMiddleware } from '../middleware/initData';

export async function regionsRoutes(app: FastifyInstance) {
  app.get('/api/regions', { preHandler: initDataMiddleware }, async () => {
    const regions = await prisma.regionConfig.findMany();
    return regions.map(r => ({
      ...r,
      denominations: (r.denominations as any[]).filter(d => d.active),
    }));
  });
}