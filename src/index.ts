import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { config } from './config';
import { prisma } from './prisma';
import { catalogRoutes } from './routes/catalog';
import { regionsRoutes } from './routes/regions';
import { checkoutRoutes } from './routes/checkout';
import { ordersRoutes } from './routes/orders';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { botRoutes } from './routes/bot';
import { setupBotWebhook } from './services/bot';

const app = Fastify({
  logger: {
    transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
  },
});

async function main() {
  await app.register(cors, {
    origin: [config.WEBAPP_URL, config.ADMIN_URL],
    credentials: true,
  });

  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(cookie, { secret: config.JWT_SECRET });
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: '15m' },
    verify: {},
    cookie: { cookieName: 'accessToken', signed: false },
  });
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }));

  await app.register(catalogRoutes);
  await app.register(regionsRoutes);
  await app.register(checkoutRoutes);
  await app.register(ordersRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(botRoutes);

  await prisma.$connect();
  console.log('Database connected');

  if (config.NODE_ENV === 'production') {
    await setupBotWebhook(config.WEBAPP_URL.replace('/bot/webhook', ''));
  }

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const gracefulShutdown = async () => {
  console.log('Shutting down...');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

main();