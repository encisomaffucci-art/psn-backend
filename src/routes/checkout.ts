import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { initDataMiddleware } from '../middleware/initData';
import { pickGiftCards } from '../services/checkout';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/api/checkout/calculate', { preHandler: initDataMiddleware }, async (request, reply) => {
    const { items, region = 'TR', currency = 'BYN' } = request.body as {
      items: { gameId: string; editionName: string }[];
      region?: string;
      currency?: string;
    };

    const regionConfig = await prisma.regionConfig.findUnique({ where: { code: region } });
    if (!regionConfig) return reply.code(400).send({ error: 'Invalid region' });

    let storeSum = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const game = await prisma.game.findUnique({ where: { id: item.gameId } });
      if (!game) continue;

      const edition = (game.editions as any[]).find(e => e.name === item.editionName);
      if (!edition) continue;

      const price = edition.prices[region] || 0;
      storeSum += price;
      validatedItems.push({ ...item, price });
    }

    const denominations = (regionConfig.denominations as any[])
      .filter(d => d.active)
      .map(d => d.val);

    const pack = pickGiftCards(storeSum, denominations);
    const remainder = pack.totalFaceValue - storeSum;

    const fiatRates: Record<string, number> = { BYN: 1, USD: 0.305, EUR: 0.28 };
    const fiatRate = fiatRates[currency] || 1;
    const totalFiat = pack.totalFaceValue * regionConfig.rateToBYN * fiatRate;

    return {
      storeSum,
      totalFaceValue: pack.totalFaceValue,
      remainder,
      totalFiat: Math.ceil(totalFiat * 100) / 100,
      currency,
      region,
      giftCards: pack.grouped,
      items: validatedItems,
    };
  });
}