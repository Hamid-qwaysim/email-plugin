/**
 * Browse Abandonment (#18). Detects repeated product/category interest that did
 * NOT result in a cart, and recommends a follow-up. Pure and unit-tested.
 */
export interface BrowseSignal {
  productId: number;
  category?: string;
  views: number;
}

export interface BrowseInput {
  signals: BrowseSignal[];
  addedToCart: boolean;
  hasEmail: boolean;
}

export interface BrowseFollowUp {
  trigger: boolean;
  channel: 'email' | 'onsite';
  topProductId: number | null;
  topCategory: string | null;
  reason: string;
}

const MIN_VIEWS = 3;

export function detectBrowseAbandon(input: BrowseInput): BrowseFollowUp {
  const none: BrowseFollowUp = {
    trigger: false,
    channel: 'onsite',
    topProductId: null,
    topCategory: null,
    reason: 'No repeated interest detected.',
  };
  if (input.addedToCart) return { ...none, reason: 'Visitor added to cart; not a browse-abandon case.' };

  const repeated = [...input.signals].filter((s) => s.views >= MIN_VIEWS).sort((a, b) => b.views - a.views);
  if (repeated.length === 0) return none;

  const top = repeated[0]!;
  const catCounts = new Map<string, number>();
  for (const s of input.signals) {
    if (s.category) catCounts.set(s.category, (catCounts.get(s.category) ?? 0) + s.views);
  }
  const topCategory = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    trigger: true,
    channel: input.hasEmail ? 'email' : 'onsite',
    topProductId: top.productId,
    topCategory,
    reason: `Viewed product ${top.productId} ${top.views}× without adding to cart.`,
  };
}
