import { describe, it, expect } from 'vitest';
import { buildCanonicalString, isTimestampFresh, timingSafeEqual } from '@arre/shared';

describe('signing', () => {
  it('canonical string is stable and order-sensitive', () => {
    const s = buildCanonicalString({
      method: 'post',
      path: '/v1/plugin/events',
      storeId: 'str_1',
      licenseKey: 'ARRE-AAAA-BBBB-CCCC-DDDD',
      timestamp: 1700000000,
      nonce: 'abc',
      bodyHashHex: 'deadbeef',
    });
    expect(s.split('\n')[0]).toBe('v1');
    expect(s).toContain('POST');
    expect(s).toContain('/v1/plugin/events');
    expect(s.endsWith('deadbeef')).toBe(true);
  });

  it('timestamp freshness window', () => {
    const now = 1_000_000;
    expect(isTimestampFresh(now, now)).toBe(true);
    expect(isTimestampFresh(now - 299, now)).toBe(true);
    expect(isTimestampFresh(now - 301, now)).toBe(false);
  });

  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'ab')).toBe(false);
  });
});
