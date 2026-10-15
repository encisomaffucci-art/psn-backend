import { FastifyInstance } from 'fastify';
import { bot } from '../services/bot';

export async function botRoutes(app: FastifyInstance) {
  app.post('/bot/webhook', async (request, reply) => {
    await bot.handleUpdate(request.body as any);
    return { ok: true };
  });
}