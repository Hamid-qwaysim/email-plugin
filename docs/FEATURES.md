# Feature Coverage (all 25)

How each required feature is implemented across the backend (Worker), the SaaS
dashboard (web), and the WordPress plugin. "Logic" columns reference the pure,
unit-tested modules. SMS is intentionally excluded.

Legend: **L** = backend logic, **API** = endpoint, **UI** = dashboard page,
**WP** = plugin wiring, **T** = unit tests.

| # | Feature | Implementation |
|---|---------|----------------|
| 1 | AI Visitor Tracking | WP tracker (`assets/js/tracker.js`) + signed `/plugin/events` ingest + `lib/intent.ts` scoring (T) + `scoreVisitor` job; UI: Customers page. |
| 2 | Smart Abandoned Cart Recovery | `lib/recovery.ts` (T) + `recovery-scan.ts` cron + `lib/carts.ts` lifecycle + plugin cart snapshots. |
| 3 | AI Coupon Engine | `lib/coupon.ts` (T) + `/merchant/stores/:id/coupons/generate` + plugin `class-arre-coupons.php` (real WC coupons); UI: Coupons page. |
| 4 | AI Email Marketing Autopilot | `email/provider.ts` (SendGrid/mock) + `send_email` job + `/ai/email`; recovery emails dispatched by the scan. |
| 5 | Multi-channel (no SMS) | `messages` table + `/merchant/stores/:id/channels` + `/web-push/subscribe`; WhatsApp provider gated until configured. |
| 6 | Visual Automation Builder | `features/automation.ts` stepper + validator (T) + automations CRUD/status APIs; UI: Automations page. |
| 7 | Smart Segments | `features/segments.ts` auto-classify + rule-tree eval (T) + segments APIs; UI: Segments page. |
| 8 | Product Recommendation Engine | `features/recommendations.ts` (7 strategies, T) + recommendations API. |
| 9 | On-site Personalization | `features/onsite.ts` targeting + caps (T) + `/plugin/onsite` + plugin `class-arre-onsite.php` + `onsite.js` renderer. |
| 10 | Exit Intent Offers | tracker exit-intent detection + onsite selection + frequency caps (T) + onsite.js exit handler. |
| 11 | AI Store Doctor | `features/doctor.ts` (T) + `/store-doctor` API; UI: Store Doctor page. |
| 12 | Revenue Attribution | `/merchant/stores/:id/overview` + `/attribution`; UI: Home hero metrics. |
| 13 | AI Campaign Generator | `/merchant/stores/:id/campaigns/generate` (AI) + persist + launch; UI: Campaigns page. |
| 14 | Auto A/B Testing | `features/abtest.ts` two-proportion z-test winner (T) + `/ab-tests/evaluate` API. |
| 15 | AI Pricing & Discount Protection | profit guard in `lib/coupon.ts` (T), applied by coupon generation. |
| 16 | Customer Timeline | `/merchant/stores/:id/customers/:cid/timeline` assembling orders + emails. |
| 17 | Lead Capture Forms | `/forms/submit` (customer + consent records) + onsite lead-form kind. |
| 18 | Browse Abandonment | `features/browse.ts` detection (T); events captured by tracker. |
| 19 | Checkout Friction Detection | `features/friction.ts` funnel analysis (T) + `/friction` API. |
| 20 | AI Email Designer | `features/email-render.ts` block→safe HTML + text (T) + preview/template APIs; UI: Email Designer page. |
| 21 | Subscription & License Control | `shared/license.ts` state machine + kill switch (T) + signed plugin API + admin controls + plugin gating. |
| 22 | White-label / Agency | `/v1/agency/*` clients + branding + aggregated metrics; UI: Agency page. |
| 23 | AI Monthly Growth Report | `features/report.ts` assembles metrics + writes HTML to R2 + records row; UI: Reports page. |
| 24 | Plug-and-play Templates | `shared/store-types.ts` presets + `/apply-template`; applied at store creation. |
| 25 | Smart Deliverability | `features/deliverability.ts` score + checklist (T) + `/deliverability` API; UI: Deliverability page. |

## Honest depth note

Every feature has real, working logic — not empty stubs — plus persistence and
wiring. Where a feature's "complete commercial" surface is large (e.g. a full
drag-and-drop automation canvas, exhaustive email-flow libraries, or live web
push delivery), the engine/decision logic and data flow are implemented and
tested, while the richest UI affordances are intentionally lean and built to be
extended. The critical commercial path (license/kill-switch, signed comms,
recovery, coupons) is the most complete.

## Tests

`apps/api/test`: `license`, `signing`, `coupon`, `recovery`, and `features`
(segments, recommendations, friction, doctor, a/b, deliverability, email render,
automation, onsite, browse) — 42 tests.
