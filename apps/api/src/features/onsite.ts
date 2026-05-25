/**
 * On-site Personalization (#9), Exit Intent (#10), Lead Capture (#17) — shared
 * targeting + frequency-cap logic. Pure and unit-tested. Given a set of onsite
 * elements + the current visitor context + recent impression history, decide
 * which element to show.
 */
export type OnsiteKind =
  | 'top_bar' | 'popup' | 'slide_in' | 'cart_reminder' | 'exit_intent'
  | 'reco_block' | 'returning_message' | 'vip_message' | 'first_order'
  | 'lead_form' | 'back_in_stock';

export interface OnsiteElement {
  id: string;
  kind: OnsiteKind;
  priority: number;
  segments?: string[]; // show only if visitor is in one of these
  pages?: string[]; // path globs; empty = all pages
  frequency: { perSession?: number; perDay?: number; cooldownMinutes?: number };
}

export interface VisitorContext {
  segments: string[];
  path: string;
  trigger?: 'exit_intent' | 'page_load' | 'cart';
}

export interface ImpressionHistory {
  // elementId -> impressions
  sessionCount: Record<string, number>;
  dayCount: Record<string, number>;
  lastShownAt: Record<string, number>; // elementId -> unix ms
}

export function selectOnsite(
  elements: OnsiteElement[],
  ctx: VisitorContext,
  history: ImpressionHistory,
  now: number = Date.now(),
): OnsiteElement | null {
  const eligible = elements
    .filter((el) => matchesTrigger(el, ctx))
    .filter((el) => matchesSegment(el, ctx))
    .filter((el) => matchesPage(el, ctx))
    .filter((el) => withinFrequency(el, history, now))
    .sort((a, b) => b.priority - a.priority);
  return eligible[0] ?? null;
}

function matchesTrigger(el: OnsiteElement, ctx: VisitorContext): boolean {
  if (el.kind === 'exit_intent') return ctx.trigger === 'exit_intent';
  if (el.kind === 'cart_reminder') return ctx.trigger === 'cart' || ctx.trigger === 'page_load';
  return true;
}

function matchesSegment(el: OnsiteElement, ctx: VisitorContext): boolean {
  if (!el.segments || el.segments.length === 0) return true;
  return el.segments.some((s) => ctx.segments.includes(s));
}

function matchesPage(el: OnsiteElement, ctx: VisitorContext): boolean {
  if (!el.pages || el.pages.length === 0) return true;
  return el.pages.some((p) => globMatch(p, ctx.path));
}

export function withinFrequency(el: OnsiteElement, h: ImpressionHistory, now: number): boolean {
  const f = el.frequency;
  if (f.perSession !== undefined && (h.sessionCount[el.id] ?? 0) >= f.perSession) return false;
  if (f.perDay !== undefined && (h.dayCount[el.id] ?? 0) >= f.perDay) return false;
  if (f.cooldownMinutes !== undefined) {
    const last = h.lastShownAt[el.id];
    if (last && now - last < f.cooldownMinutes * 60000) return false;
  }
  return true;
}

function globMatch(pattern: string, path: string): boolean {
  if (pattern === '*' || pattern === '') return true;
  const re = new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$');
  return re.test(path);
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
