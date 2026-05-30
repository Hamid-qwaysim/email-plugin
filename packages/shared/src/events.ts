/** Behavioral events uploaded by the plugin tracker, in batches. */
export const EVENT_TYPES = [
  'page_view',
  'product_view',
  'category_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'cart_updated',
  'checkout_started',
  'checkout_field_focus',
  'checkout_error',
  'coupon_applied',
  'coupon_failed',
  'quantity_changed',
  'order_created',
  'purchase_completed',
  'email_captured',
  'popup_viewed',
  'popup_clicked',
  'exit_intent',
  'scroll_depth',
  'returning_visit',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface TrackedEvent {
  type: EventType;
  /** Client timestamp (unix ms). Server records its own receive time too. */
  ts: number;
  /** Anonymous visitor id (first-party cookie). */
  visitorId: string;
  /** Session id (rotates per session). */
  sessionId: string;
  /** WooCommerce cart token when present. */
  cartToken?: string;
  /** Logged-in WP user id when known. */
  userId?: number;
  /** Event-specific payload (product id, search term, value, etc.). */
  props?: Record<string, unknown>;
  /** Page context. */
  page?: {
    url?: string;
    referrer?: string;
    title?: string;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface EventBatch {
  storeId: string;
  events: TrackedEvent[];
  /** Consent state captured client-side. */
  consent?: {
    analytics: boolean;
    marketing: boolean;
  };
}

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

/** Intent score banding used across the UI and AI explanations. */
export type IntentBand = 'cold' | 'browsing' | 'warm' | 'high';

export function intentBand(score: number): IntentBand {
  if (score >= 85) return 'high';
  if (score >= 60) return 'warm';
  if (score >= 30) return 'browsing';
  return 'cold';
}
