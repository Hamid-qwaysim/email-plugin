# Manual QA Checklist

## Automated (run before manual QA)

- [ ] `npm run build` — shared builds, Worker type-checks, web bundles.
- [ ] `npm run test` — license / signing / coupon / intent tests pass.
- [ ] `npm run plugin:zip` — plugin PHP lints and zip is produced.

## End-to-end (the acceptance path)

- [ ] Install plugin in WordPress; confirm it requires/detects WooCommerce.
- [ ] Activate license: register a store in the SaaS, paste Store ID + key +
      signing secret into the Connection wizard; status shows **Connected & active**.
- [ ] Connect store: SaaS shows the store under Home with health.
- [ ] Sync products: run manual full sync; confirm no PHP errors.
- [ ] Track a product view: load a product page; verify a `product_view` event
      is accepted (`/plugin/events` → `accepted > 0`).
- [ ] Add to cart: verify `add_to_cart` event recorded.
- [ ] Abandon cart: leave checkout; confirm an abandoned-cart record appears.
- [ ] Generate a coupon: trigger a recovery coupon; confirm a real WC coupon is
      created with usage limit 1 and the profit-guard cap respected.
- [ ] Send a recovery email: with the mock provider, confirm the email row moves
      to `sent` and a delivery log exists.
- [ ] Complete an order: place an order; confirm `purchase_completed` recorded.
- [ ] Revenue attribution: recovered order reflected in the merchant overview.
- [ ] **Deactivate subscription:** from the admin console, set the license
      `canceled` (or hit **Kill now**). Within ~2 minutes (or on next plugin
      check) the plugin shows *“Your license is inactive. Premium features are
      paused.”* and `/plugin/events` returns 402.
- [ ] Verify premium stop: tracking script no longer loads; no coupons created;
      sync no-ops.
- [ ] **Reactivate:** set the license back to `active` (or **Restore**). Force
      re-check in the plugin; premium features resume.

## Security spot-checks

- [ ] Unsigned `GET /v1/plugin/license/validate` → 401.
- [ ] Reused nonce on a signed call → 401 (replay rejected).
- [ ] Stale timestamp (>5 min) → 401.
- [ ] Non-staff bearer hitting `/v1/admin/*` → 403.
- [ ] Admin form without a valid nonce → blocked by `check_admin_referer`.
