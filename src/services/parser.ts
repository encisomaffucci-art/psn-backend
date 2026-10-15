import { prisma } from '../prisma';

const REGIONS = ['TR', 'UA', 'PL', 'IN'] as const;

interface PSGameRaw {
  id: string;
  name: string;
  provider_name: string;
  platforms: string[];
  default_sku?: {
    price: number;
    discount_price?: number;
    plus_price?: number;
    plus_discount_price?: number;
  };
  localizations: { language: string; display_name: string }[];
  images: { role: string; url: string }[];
  skus: PSGameSKU[];
}

interface PSGameSKU {
  id: string;
  name: string;
  display_price: number;
  original_price?: number;
  plus_price?: number;
  plus_original_price?: number;
}

const REGION_MAP: Record<string, { code: string; flag: string; symbol: string; currency: string; rate: number }> = {
  TR: { code: 'TRY', flag: '🇹🇷', symbol: 'TL', currency: 'TRY', rate: 0.105 },
  UA: { code: 'UAH', flag: '🇺🇦', symbol: 'UAH', currency: 'UAH', rate: 0.085 },
  PL: { code: 'PLN', flag: '🇵🇱', symbol: 'PLN', currency: 'PLN', rate: 0.86 },
  IN: { code: 'INR', flag: '🇮🇳', symbol: '₹', currency: 'INR', rate: 0.042 },
};

async function fetchRegionCatalog(region: string): Promise<PSGameRaw[]> {
  const url = `https://store.playstation.com/valkyrie-api/${region.toLowerCase()}/19/resolve/${region}/games?fields=name,provider_name,platforms,default_sku,localizations,images,skus&size=200`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as any;
    return data.included || data.games || [];
  } catch (e) {
    console.error(`Failed to fetch ${region} catalog:`, e);
    return [];
  }
}

function normalizeGame(raw: PSGameRaw, region: string): any {
  const reg = REGION_MAP[region];
  const ruLoc = raw.localizations.find(l => l.language === 'ru')?.display_name || '';
  
  const cover = raw.images.find(i => i.role === 'cover')?.url || raw.images[0]?.url || '';
  const hero = raw.images.find(i => i.role === 'hero')?.url || raw.images.find(i => i.role === 'banner')?.url || cover;

  const editions = raw.skus.map(sku => {
    const prices: Record<string, number> = {};
    const oldPrices: Record<string, number> = {};
    
    REGIONS.forEach(r => {
      prices[r] = Math.round(sku.display_price * (REGION_MAP[r].rate / reg.rate));
      if (sku.original_price && sku.original_price > sku.display_price) {
        oldPrices[r] = Math.round(sku.original_price * (REGION_MAP[r].rate / reg.rate));
      }
    });

    return {
      name: sku.name,
      prices,
      oldPrices: Object.keys(oldPrices).length > 0 ? oldPrices : undefined,
    };
  });

  const defaultSku = raw.skus[0];
  const discount = defaultSku?.original_price && defaultSku.original_price > defaultSku.display_price
    ? Math.round((1 - defaultSku.display_price / defaultSku.original_price) * 100)
    : 0;

  const shelfTags = ['latest'];
  if (discount > 0) shelfTags.push('deals');
  if (discount > 30) shelfTags.push('bestseller');

  return {
    id: raw.id,
    title: raw.name,
    publisher: raw.provider_name,
    platforms: raw.platforms,
    ruLocalization: ruLoc || 'Русский язык не указан',
    coverUrl: cover,
    heroUrl: hero,
    discount,
    shelfTags,
    editions,
    isAutoSynced: true,
  };
}

export async function syncBestsellers() {
  console.log('Starting bestsellers sync...');
  let totalSynced = 0;

  for (const region of REGIONS) {
    try {
      const rawGames = await fetchRegionCatalog(region);
      const bestsellers = rawGames.filter(g => {
        const discount = g.skus[0]?.original_price && g.skus[0].original_price > g.skus[0].display_price
          ? (1 - g.skus[0].display_price / g.skus[0].original_price) * 100
          : 0;
        return discount > 30 || (g.default_sku?.plus_price && g.default_sku.plus_discount_price);
      });

      console.log(`${region}: ${bestsellers.length} bestsellers found`);

      for (const raw of bestsellers) {
        try {
          const normalized = normalizeGame(raw, region);
          await prisma.game.upsert({
            where: { id: normalized.id },
            create: normalized,
            update: {
              title: normalized.title,
              publisher: normalized.publisher,
              platforms: normalized.platforms,
              ruLocalization: normalized.ruLocalization,
              coverUrl: normalized.coverUrl,
              heroUrl: normalized.heroUrl,
              discount: normalized.discount,
              shelfTags: normalized.shelfTags,
              editions: normalized.editions,
              isAutoSynced: true,
            },
          });
          totalSynced++;
        } catch (e) {
          console.error(`Failed to upsert game ${raw.id}:`, e);
        }
      }
    } catch (e) {
      console.error(`Region ${region} sync failed:`, e);
    }
  }

  console.log(`Sync complete. Total synced: ${totalSynced}`);
}

export async function syncOnce() {
  await syncBestsellers();
  await prisma.$disconnect();
}

if (require.main === module) {
  syncOnce().catch(console.error);
}