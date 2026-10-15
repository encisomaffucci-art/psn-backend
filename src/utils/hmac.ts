import { createHmac } from 'crypto';
import { config } from '../config';

export function validateInitData(initData: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(config.BOT_TOKEN).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) return { valid: false };

    const userStr = params.get('user');
    const user = userStr ? JSON.parse(userStr) : undefined;

    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

export function validateTelegramLoginWidget(authData: Record<string, string>): boolean {
  const { hash, ...data } = authData;
  if (!hash) return false;

  const dataCheckString = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', config.BOT_TOKEN).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return calculatedHash === hash;
}