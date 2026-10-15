import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { initDataMiddleware } from '../middleware/initData';

interface GameEdition {
  name: string;
  prices: Record<string, number>;
  oldPrices?: Record<string, number>;
}

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/api/catalog', { preHandler: initDataMiddleware }, async (request, reply) => {
    const { shelf, region = 'TR' } = request.query as { shelf?: string; region?: string };
    
    const where = shelf ? { shelfTags: { has: shelf } } : {};
    const games = await prisma.game.findMany({ 
      where, 
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const transformed = games.map(game => {
      const editions = game.editions as unknown as GameEdition[];
      const edition = editions[0];
      const price = edition?.prices?.[region] || 0;
      const oldPrice = edition?.oldPrices?.[region];
      return {
        ...game,
        price,
        oldPrice,
        formattedPrice: price.toLocaleString('ru-RU'),
      };
    });

    return transformed;
  });

  app.get('/api/catalog/:id', { preHandler: initDataMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { region = 'TR' } = request.query as { region?: string };

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.code(404).send({ error: 'Not found' });

    const editions = (game.editions as unknown as GameEdition[]).map(e => ({
      name: e.name,
      price: e.prices[region] || 0,
      oldPrice: e.oldPrices?.[region],
      formattedPrice: (e.prices[region] || 0).toLocaleString('ru-RU'),
    }));

    return { ...game, editions, region };
  });
}