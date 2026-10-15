import { bot } from './bot';
import { prisma } from '../prisma';
import { config } from '../config';

export async function notifyAdminNewOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || !order.receiptFileId) return;

  try {
    await bot.telegram.sendPhoto(config.ADMIN_ID, order.receiptFileId, {
      caption: `🆕 Новый заказ #${order.id.slice(-6)}
👤 @${order.userName || order.userId}
💰 ${order.totalFiat.toFixed(2)} ${order.currency} (${order.totalStore.toLocaleString()} в сторе)
🌍 Регион: ${order.region} | Способ: ${order.paymentMethod}
📦 Товаров: ${(order.items as any[]).length}
🕐 ${order.createdAt.toLocaleString('ru-RU')}`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Подтвердить', callback_data: `admin:confirm:${order.id}` }],
          [{ text: '❌ Отклонить', callback_data: `admin:reject:${order.id}` }],
        ],
      },
    });
  } catch (e) {
    console.error('Failed to notify admin:', e);
  }
}

export async function notifyUserOrderConfirmed(orderId: string, codes: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  try {
    await bot.telegram.sendMessage(order.userId, `✅ Ваш заказ #${order.id.slice(-6)} подтверждён!

🎮 Коды пополнения:
${codes}

Спасибо за покупку в PSN.BY!`);
  } catch (e) {
    console.error('Failed to notify user:', e);
  }
}

export async function notifyUserOrderRejected(orderId: string, reason: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  try {
    await bot.telegram.sendMessage(order.userId, `❌ Ваш заказ #${order.id.slice(-6)} отклонён.

Причина: ${reason}

Обратитесь в поддержку для уточнения деталей.`);
  } catch (e) {
    console.error('Failed to notify user:', e);
  }
}