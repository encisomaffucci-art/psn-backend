import { FastifyInstance } from 'fastify';
import { prisma } from '../prisma';
import { initDataMiddleware } from '../middleware/initData';
import { notifyAdminNewOrder } from '../services/notifications';

export async function ordersRoutes(app: FastifyInstance) {
  app.post('/api/orders', { preHandler: initDataMiddleware }, async (request, reply) => {
    const user = (request as any).user;
    const { 
      items, 
      currency, 
      region, 
      paymentMethod, 
      giftCards, 
      totalStore, 
      totalFiat, 
      remainder 
    } = request.body as any;

    const order = await prisma.order.create({
      data: {
        userId: user.id.toString(),
        userName: user.username || user.first_name,
        items,
        totalStore,
        totalFiat,
        currency,
        region,
        giftCards,
        remainder,
        paymentMethod,
        status: 'PENDING',
      },
    });

    await notifyAdminNewOrder(order.id);
    return { orderId: order.id };
  });

  app.post('/api/orders/:id/receipt', { preHandler: initDataMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const botToken = process.env.BOT_TOKEN!;
    const form = new FormData();
    form.append('chat_id', process.env.ADMIN_ID!);
    form.append('photo', new Blob([buffer]), 'receipt.jpg');

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    const result = await res.json() as any;
    const fileId = result.result?.photo?.[result.result.photo.length - 1]?.file_id;

    if (!fileId) return reply.code(500).send({ error: 'Failed to upload' });

    await prisma.order.update({
      where: { id },
      data: { receiptFileId: fileId, status: 'PENDING' },
    });

    return { ok: true };
  });
}