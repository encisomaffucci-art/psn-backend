import { Telegraf, session } from 'telegraf';
import { config } from '../config';
import { prisma } from '../prisma';
import { notifyAdminNewOrder } from './notifications';

interface BotSession {
  awaitingCodes?: string;
  awaitingRejectReason?: string;
}

type BotContext = any;

export const bot = new Telegraf<BotContext>(config.BOT_TOKEN);

bot.use(session());

bot.start(async (ctx) => {
  await ctx.reply('Добро пожаловать в PSN.BY! 🎮', {
    reply_markup: {
      inline_keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: config.WEBAPP_URL } }]],
    },
  });
});

bot.command('admin', async (ctx) => {
  if (ctx.from?.id.toString() !== config.ADMIN_ID) return;

  await ctx.reply('🔧 Админ-панель', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📦 Заказы', callback_data: 'admin:orders:0' }],
        [{ text: '💱 Курсы и номиналы', callback_data: 'admin:regions' }],
        [{ text: '💳 Реквизиты', callback_data: 'admin:credentials' }],
        [{ text: '🎮 Каталог', callback_data: 'admin:catalog' }],
      ],
    },
  });
});

bot.on('callback_query', async (ctx) => {
  const callbackQuery = ctx.callbackQuery as any;
  const data = callbackQuery.data;
  if (!data) return;

  try {
    if (data === 'admin:regions') {
      const regions = await prisma.regionConfig.findMany();
      const text = regions.map(r =>
        `${r.flag} ${r.name} (${r.code})
Курс: 1 ${r.currencyCode} = ${r.rateToBYN} BYN
Номиналы: ${(r.denominations as any[]).filter(d => d.active).map(d => d.val).join(', ')}`
      ).join('\n\n');
      await ctx.editMessageText(text || 'Нет регионов', {
        reply_markup: { inline_keyboard: [[{ text: '← Назад', callback_data: 'admin:back' }]] },
      });
    } else if (data === 'admin:credentials') {
      const creds = await prisma.paymentCredentials.findUnique({ where: { id: 'singleton' } });
      const text = `💳 Реквизиты оплаты:
Карта: ${creds?.cardNumber || 'не задано'}
ЕРИП: ${creds?.eripPath || 'не задано'}
USDT: ${creds?.usdtAddress || 'не задано'}`;
      await ctx.editMessageText(text, {
        reply_markup: { inline_keyboard: [[{ text: '← Назад', callback_data: 'admin:back' }]] },
      });
    } else if (data === 'admin:catalog') {
      const games = await prisma.game.findMany({ take: 10, orderBy: { updatedAt: 'desc' } });
      const text = games.map(g => `${g.isAutoSynced ? '🤖' : '✏️'} ${g.title} (${g.id})`).join('\n') || 'Каталог пуст';
      await ctx.editMessageText(text, {
        reply_markup: { inline_keyboard: [[{ text: '← Назад', callback_data: 'admin:back' }]] },
      });
    } else if (data.startsWith('admin:orders')) {
      const page = parseInt(data.split(':')[2] || '0');
      const take = 5;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({ skip: page * take, take, orderBy: { createdAt: 'desc' } }),
        prisma.order.count(),
      ]);
      const text = orders.map(o =>
        `#${o.id.slice(-6)} | ${o.totalFiat.toFixed(2)} ${o.currency} | ${o.region} | ${o.status} | ${o.createdAt.toLocaleDateString('ru-RU')}`
      ).join('\n') || 'Нет заказов';
      const keyboard: any[][] = [];
      if (page > 0) keyboard.push([{ text: '← Назад', callback_data: `admin:orders:${page - 1}` }]);
      if ((page + 1) * take < total) keyboard.push([{ text: 'Вперёд →', callback_data: `admin:orders:${page + 1}` }]);
      keyboard.push([{ text: '← В меню', callback_data: 'admin:back' }]);
      await ctx.editMessageText(text, { reply_markup: { inline_keyboard: keyboard } });
    } else if (data.startsWith('admin:confirm:')) {
      const orderId = data.split(':')[2];
      (ctx as any).session.awaitingCodes = orderId;
      await ctx.editMessageText(`Введите коды пополнения для заказа #${orderId.slice(-6)} (через пробел или новой строкой):`);
    } else if (data.startsWith('admin:reject:')) {
      const orderId = data.split(':')[2];
      (ctx as any).session.awaitingRejectReason = orderId;
      await ctx.editMessageText(`Введите причину отказа для заказа #${orderId.slice(-6)}:`);
    } else if (data === 'admin:back') {
      await ctx.editMessageText('🔧 Админ-панель', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Заказы', callback_data: 'admin:orders:0' }],
            [{ text: '💱 Курсы и номиналы', callback_data: 'admin:regions' }],
            [{ text: '💳 Реквизиты', callback_data: 'admin:credentials' }],
            [{ text: '🎮 Каталог', callback_data: 'admin:catalog' }],
          ],
        },
      });
    }
  } catch (e) {
    console.error('Callback error:', e);
    await ctx.answerCbQuery('Ошибка');
  }
});

bot.on('text', async (ctx) => {
  if (ctx.from?.id.toString() !== config.ADMIN_ID) return;
  const session = (ctx as any).session as BotSession;

  if (session?.awaitingCodes) {
    const codes = ctx.message.text.trim();
    await prisma.order.update({
      where: { id: session.awaitingCodes },
      data: { status: 'COMPLETED', adminNote: codes },
    });
    await notifyUserOrderConfirmed(session.awaitingCodes, codes);
    await ctx.reply('✅ Заказ подтверждён, коды отправлены клиенту');
    (ctx as any).session = {};
  } else if (session?.awaitingRejectReason) {
    const reason = ctx.message.text.trim();
    await prisma.order.update({
      where: { id: session.awaitingRejectReason },
      data: { status: 'REJECTED', adminNote: reason },
    });
    await notifyUserOrderRejected(session.awaitingRejectReason, reason);
    await ctx.reply('❌ Заказ отклонён, клиент уведомлён');
    (ctx as any).session = {};
  }
});

async function notifyUserOrderConfirmed(orderId: string, codes: string) {
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

async function notifyUserOrderRejected(orderId: string, reason: string) {
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

export async function setupBotWebhook(url: string) {
  await bot.telegram.setWebhook(`${url}/bot/webhook`);
  console.log('Bot webhook set to', url);
}