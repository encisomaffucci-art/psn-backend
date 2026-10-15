import { FastifyRequest, FastifyReply } from 'fastify';
import { validateInitData } from '../utils/hmac';

export async function initDataMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const initData = request.headers['x-telegram-init-data'] as string;

  if (!initData) {
    return reply.code(401).send({ error: 'Missing initData' });
  }

  const { valid, user } = validateInitData(initData);

  if (!valid) {
    return reply.code(401).send({ error: 'Invalid initData' });
  }

  (request as any).user = user;
}