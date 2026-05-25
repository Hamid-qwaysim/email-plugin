/**
 * Product Recommendation Engine (#8). Pure ranking over a candidate product
 * set given a strategy and optional context (viewed products, co-purchase
 * pairs). Deterministic and unit-tested; the AI layer only adds explanations.
 */
export interface ProductLite {
  wooId: number;
  name: string;
  priceCents: number;
  categories: string[];
  stockStatus: string; // 'instock' | 'outofstock' | ...
  salesCount?: number;
  createdAt?: number;
}

export type RecoStrategy =
  | 'similar'
  | 'bestsellers'
  | 'frequently_bought'
  | 'trending'
  | 'cheaper_alternative'
  | 'premium_alternative'
  | 'recently_viewed'
  | 'back_in_stock';

export interface RecoContext {
  anchor?: ProductLite; // current/last viewed product
  viewedIds?: number[];
  coPurchase?: Record<number, number[]>; // productId -> frequently bought with
}

export function recommend(
  strategy: RecoStrategy,
  candidates: ProductLite[],
  ctx: RecoContext = {},
  limit = 8,
): ProductLite[] {
  const inStock = candidates.filter((p) => p.stockStatus === 'instock');
  let ranked: ProductLite[] = [];

  switch (strategy) {
    case 'bestsellers':
      ranked = [...inStock].sort((a, b) => (b.salesCount ?? 0) - (a.salesCount ?? 0));
      break;
    case 'trending':
      // Recent + selling: weight recency and sales.
      ranked = [...inStock].sort(
        (a, b) => score(b) - score(a),
      );
      break;
    case 'similar':
      ranked = bySharedCategory(inStock, ctx.anchor);
      break;
    case 'cheaper_alternative':
      ranked = bySharedCategory(inStock, ctx.anchor).filter(
        (p) => ctx.anchor && p.priceCents < ctx.anchor.priceCents,
      );
      break;
    case 'premium_alternative':
      ranked = bySharedCategory(inStock, ctx.anchor).filter(
        (p) => ctx.anchor && p.priceCents > ctx.anchor.priceCents,
      );
      break;
    case 'frequently_bought': {
      const ids = ctx.anchor ? ctx.coPurchase?.[ctx.anchor.wooId] ?? [] : [];
      ranked = ids
        .map((id) => inStock.find((p) => p.wooId === id))
        .filter((p): p is ProductLite => !!p);
      break;
    }
    case 'recently_viewed':
      ranked = (ctx.viewedIds ?? [])
        .map((id) => candidates.find((p) => p.wooId === id))
        .filter((p): p is ProductLite => !!p);
      break;
    case 'back_in_stock':
      ranked = candidates.filter((p) => p.stockStatus === 'instock');
      break;
  }

  // Never recommend the anchor product itself.
  if (ctx.anchor) ranked = ranked.filter((p) => p.wooId !== ctx.anchor!.wooId);
  return ranked.slice(0, limit);

  function score(p: ProductLite): number {
    const ageDays = p.createdAt ? (Date.now() - p.createdAt) / 86400000 : 365;
    const recency = Math.max(0, 90 - ageDays);
    return (p.salesCount ?? 0) * 2 + recency;
  }
}

function bySharedCategory(products: ProductLite[], anchor?: ProductLite): ProductLite[] {
  if (!anchor) return products;
  const set = new Set(anchor.categories);
  return [...products].sort((a, b) => overlap(b) - overlap(a));
  function overlap(p: ProductLite): number {
    return p.categories.filter((c) => set.has(c)).length;
  }
}
