export interface GiftCardPick {
  cards: number[];
  totalFaceValue: number;
  grouped: Record<number, number>;
}

export function pickGiftCards(targetAmount: number, denominations: number[]): GiftCardPick {
  if (targetAmount <= 0) return { cards: [], totalFaceValue: 0, grouped: {} };

  const available = [...new Set(denominations.filter(d => d > 0))].sort((a, b) => a - b);
  if (available.length === 0) return { cards: [targetAmount], totalFaceValue: targetAmount, grouped: { [targetAmount]: 1 } };

  const minDenom = available[0];
  const maxSearch = targetAmount + available[available.length - 1];
  const dp = new Array(maxSearch + 1).fill(Infinity);
  const parent = new Array(maxSearch + 1).fill(-1);
  const coinUsed = new Array(maxSearch + 1).fill(-1);
  dp[0] = 0;

  for (let i = 0; i <= maxSearch; i++) {
    if (dp[i] === Infinity) continue;
    for (const c of available) {
      if (i + c <= maxSearch && dp[i] + 1 < dp[i + c]) {
        dp[i + c] = dp[i] + 1;
        parent[i + c] = i;
        coinUsed[i + c] = c;
      }
    }
  }

  let bestSum = -1;
  for (let s = targetAmount; s <= maxSearch; s++) {
    if (dp[s] !== Infinity) {
      bestSum = s;
      break;
    }
  }

  if (bestSum === -1) {
    const largest = available[available.length - 1];
    const count = Math.ceil(targetAmount / largest);
    const cards = Array(count).fill(largest);
    return { cards, totalFaceValue: count * largest, grouped: { [largest]: count } };
  }

  const cards: number[] = [];
  let cur = bestSum;
  while (cur > 0) {
    cards.push(coinUsed[cur]);
    cur = parent[cur];
  }
  cards.sort((a, b) => b - a);

  const grouped: Record<number, number> = {};
  cards.forEach(c => grouped[c] = (grouped[c] || 0) + 1);

  return { cards, totalFaceValue: bestSum, grouped };
}

export function calculateFiatTotal(storeAmount: number, rateToBYN: number, fiatRate: number): number {
  return storeAmount * rateToBYN * fiatRate;
}