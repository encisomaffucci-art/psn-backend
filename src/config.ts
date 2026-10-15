import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  ADMIN_ID: z.string().min(1),
  WEBAPP_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
  PORT: z.coerce.number().default(3000),
  SENTRY_DSN: z.string().url().optional(),
});

export const config = envSchema.parse(process.env);