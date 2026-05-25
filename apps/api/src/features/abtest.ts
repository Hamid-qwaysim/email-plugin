/**
 * Auto A/B Testing (#14). Decides whether a test has a statistically
 * meaningful winner using a two-proportion z-test, and picks the winner once
 * confident (or a minimum sample is reached). Pure and unit-tested.
 */
export interface Variant {
  id: string;
  sent: number;
  conversions: number;
}

export interface AbResult {
  decided: boolean;
  winnerId: string | null;
  confidence: number; // 0..1 (1 - p approx)
  reason: string;
}

const MIN_SAMPLE_PER_VARIANT = 100;
const CONFIDENCE_THRESHOLD = 0.95;

export function rate(v: Variant): number {
  return v.sent > 0 ? v.conversions / v.sent : 0;
}

export function evaluateTest(variants: Variant[]): AbResult {
  if (variants.length < 2) {
    return { decided: false, winnerId: null, confidence: 0, reason: 'Need at least two variants.' };
  }
  const sorted = [...variants].sort((a, b) => rate(b) - rate(a));
  const top = sorted[0]!;
  const second = sorted[1]!;

  if (variants.some((v) => v.sent < MIN_SAMPLE_PER_VARIANT)) {
    return { decided: false, winnerId: null, confidence: 0, reason: 'Collecting more data (min sample not reached).' };
  }

  const z = twoProportionZ(top, second);
  const confidence = zToConfidence(z);

  if (confidence >= CONFIDENCE_THRESHOLD && rate(top) > rate(second)) {
    return {
      decided: true,
      winnerId: top.id,
      confidence,
      reason: `Variant ${top.id} wins at ${(confidence * 100).toFixed(1)}% confidence.`,
    };
  }
  return { decided: false, winnerId: null, confidence, reason: 'No significant difference yet.' };
}

function twoProportionZ(a: Variant, b: Variant): number {
  const pa = rate(a);
  const pb = rate(b);
  const pPool = (a.conversions + b.conversions) / (a.sent + b.sent);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / a.sent + 1 / b.sent));
  if (se === 0) return 0;
  return (pa - pb) / se;
}

// Standard normal CDF → one-sided confidence.
function zToConfidence(z: number): number {
  return normCdf(Math.abs(z));
}
function normCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation.
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 1 - p;
}
