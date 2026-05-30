/** Store types offered during onboarding; each seeds default presets. */
export const STORE_TYPES = [
  'fashion',
  'beauty',
  'electronics',
  'restaurant',
  'food',
  'supplements',
  'digital',
  'courses',
  'gifts',
  'baby',
  'general',
] as const;
export type StoreType = (typeof STORE_TYPES)[number];

export interface StoreTypePreset {
  type: StoreType;
  label: string;
  emailTone: string;
  /** Default max discount the AI may offer (percentage). */
  defaultMaxDiscountPct: number;
  /** Recommended recovery flow emphasis. */
  recoveryStrategy: 'reminder' | 'social_proof' | 'discount' | 'urgency' | 'free_shipping';
  popupStrategy: 'subtle' | 'standard' | 'aggressive';
  recommendationStrategy: 'similar' | 'bestsellers' | 'frequently_bought' | 'trending';
}

export const STORE_TYPE_PRESETS: Record<StoreType, StoreTypePreset> = {
  fashion: { type: 'fashion', label: 'Fashion & Apparel', emailTone: 'trendy, visual', defaultMaxDiscountPct: 15, recoveryStrategy: 'urgency', popupStrategy: 'standard', recommendationStrategy: 'similar' },
  beauty: { type: 'beauty', label: 'Beauty & Cosmetics', emailTone: 'warm, aspirational', defaultMaxDiscountPct: 12, recoveryStrategy: 'social_proof', popupStrategy: 'standard', recommendationStrategy: 'frequently_bought' },
  electronics: { type: 'electronics', label: 'Electronics', emailTone: 'clear, spec-driven', defaultMaxDiscountPct: 8, recoveryStrategy: 'reminder', popupStrategy: 'subtle', recommendationStrategy: 'similar' },
  restaurant: { type: 'restaurant', label: 'Restaurant', emailTone: 'friendly, appetizing', defaultMaxDiscountPct: 15, recoveryStrategy: 'free_shipping', popupStrategy: 'standard', recommendationStrategy: 'bestsellers' },
  food: { type: 'food', label: 'Food & Grocery', emailTone: 'fresh, friendly', defaultMaxDiscountPct: 10, recoveryStrategy: 'free_shipping', popupStrategy: 'standard', recommendationStrategy: 'bestsellers' },
  supplements: { type: 'supplements', label: 'Supplements', emailTone: 'confident, health-focused', defaultMaxDiscountPct: 12, recoveryStrategy: 'social_proof', popupStrategy: 'standard', recommendationStrategy: 'frequently_bought' },
  digital: { type: 'digital', label: 'Digital Products', emailTone: 'concise, benefit-led', defaultMaxDiscountPct: 20, recoveryStrategy: 'discount', popupStrategy: 'standard', recommendationStrategy: 'trending' },
  courses: { type: 'courses', label: 'Courses & Education', emailTone: 'encouraging, expert', defaultMaxDiscountPct: 25, recoveryStrategy: 'urgency', popupStrategy: 'standard', recommendationStrategy: 'trending' },
  gifts: { type: 'gifts', label: 'Gifts', emailTone: 'cheerful, occasion-driven', defaultMaxDiscountPct: 15, recoveryStrategy: 'urgency', popupStrategy: 'aggressive', recommendationStrategy: 'bestsellers' },
  baby: { type: 'baby', label: 'Baby Products', emailTone: 'caring, reassuring', defaultMaxDiscountPct: 12, recoveryStrategy: 'social_proof', popupStrategy: 'subtle', recommendationStrategy: 'frequently_bought' },
  general: { type: 'general', label: 'General Store', emailTone: 'friendly, helpful', defaultMaxDiscountPct: 10, recoveryStrategy: 'reminder', popupStrategy: 'standard', recommendationStrategy: 'bestsellers' },
};

export function isStoreType(value: string): value is StoreType {
  return (STORE_TYPES as readonly string[]).includes(value);
}
