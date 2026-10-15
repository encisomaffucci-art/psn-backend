import { prisma } from '../prisma';

const regions = [
  {
    code: 'TR',
    name: 'Турция',
    flag: '🇹🇷',
    symbol: 'TL',
    currencyCode: 'TRY',
    rateToBYN: 0.105,
    denominations: [
      { val: 250, active: true },
      { val: 500, active: true },
      { val: 1000, active: true },
      { val: 2000, active: true },
      { val: 3000, active: true },
    ],
  },
  {
    code: 'UA',
    name: 'Украина',
    flag: '🇺🇦',
    symbol: 'UAH',
    currencyCode: 'UAH',
    rateToBYN: 0.085,
    denominations: [
      { val: 500, active: true },
      { val: 1000, active: true },
      { val: 1500, active: true },
      { val: 2500, active: true },
    ],
  },
  {
    code: 'PL',
    name: 'Польша',
    flag: '🇵🇱',
    symbol: 'PLN',
    currencyCode: 'PLN',
    rateToBYN: 0.86,
    denominations: [
      { val: 50, active: true },
      { val: 100, active: true },
      { val: 150, active: true },
      { val: 200, active: true },
      { val: 300, active: true },
    ],
  },
  {
    code: 'IN',
    name: 'Индия',
    flag: '🇮🇳',
    symbol: '₹',
    currencyCode: 'INR',
    rateToBYN: 0.042,
    denominations: [
      { val: 1000, active: true },
      { val: 2000, active: true },
      { val: 3000, active: true },
      { val: 4000, active: true },
      { val: 5000, active: true },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  for (const region of regions) {
    await prisma.regionConfig.upsert({
      where: { code: region.code },
      create: region,
      update: region,
    });
    console.log(`✓ Region ${region.code} seeded`);
  }

  await prisma.paymentCredentials.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {},
  });
  console.log('✓ Payment credentials seeded');

  await prisma.botSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      adminId: process.env.ADMIN_ID || '5289196234',
      webappUrl: process.env.WEBAPP_URL || 'https://psn-mini-app.vercel.app',
      adminUrl: process.env.ADMIN_URL || 'https://psn-admin.vercel.app',
    },
    update: {
      adminId: process.env.ADMIN_ID || '5289196234',
      webappUrl: process.env.WEBAPP_URL || 'https://psn-mini-app.vercel.app',
      adminUrl: process.env.ADMIN_URL || 'https://psn-admin.vercel.app',
    },
  });
  console.log('✓ Bot settings seeded');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });