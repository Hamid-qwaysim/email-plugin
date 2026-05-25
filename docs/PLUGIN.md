# WordPress Plugin Guide

Plugin: **AI Revenue Recovery Engine for WooCommerce**
Folder: `plugin/ai-revenue-recovery-engine` · PHP 8.1+ · WordPress 6.3+ ·
WooCommerce 7+ · HPOS-compatible.

## Install

1. `npm run plugin:zip` → `dist/ai-revenue-recovery-engine.zip`.
2. WordPress admin → Plugins → Add New → Upload Plugin → activate.
   (WooCommerce must be active; otherwise the plugin shows a notice and stays
   inert.)

## Connect

1. In the SaaS dashboard: **Connect a store** → register your domain. You get a
   **Store ID**, **license key**, and a **one-time signing secret**.
2. In WordPress: **AI Revenue → Connection** → paste all three → **Connect**.
   The plugin binds the domain and validates the license.

## Admin pages

- **Connection** — wizard + live status (WooCommerce detected, HPOS, plan).
- **License** — key, status, reason, entitlements, force re-check, deactivate.
- **Features** — local on/off toggles per feature (a feature runs only if the
  plan includes it AND the toggle is on AND the license is active).
- **WooCommerce Sync** — manual full sync (Action Scheduler) + scheduler status.
- **Diagnostics** — environment/health snapshot (no secrets).
- **Advanced** — API endpoint, consent mode, exclude admins, debug, and a
  reset (danger zone). Uninstall cleanup is handled by `uninstall.php`.

## How it stops when inactive

- A 2-minute kill-switch poll + cached license decision (see
  `class-arre-license.php`). When inactive: tracking, event upload, coupon
  creation, popups, recommendations and sync all stop, and the admin shows
  *“Your license is inactive. Premium features are paused.”*

## Security model

- No direct file access (`defined('ABSPATH') || exit`).
- Every admin write: `current_user_can('manage_woocommerce')` +
  `check_admin_referer()` nonce.
- All input sanitized (`sanitize_text_field`, `esc_url_raw`, `absint`,
  `sanitize_email`, `sanitize_key`); all output escaped (`esc_html`, `esc_attr`,
  `esc_url`, `esc_js`).
- REST tracker endpoint uses a permission callback + nonce; props are
  shallow-sanitized; batch size capped.
- Signed outbound requests (HMAC-SHA256) with timestamp + nonce; the signing
  secret is stored in its own option and never rendered.
- Performance: tracker script is `defer`/footer, batches events, uses
  `sendBeacon` on unload, and never loads in admin or for excluded roles.

## Coupons

`class-arre-coupons.php` materializes SaaS coupon decisions as real
`WC_Coupon`s with individual-use, usage limit 1, optional email restriction,
minimum, expiry, and a profit-guard cap on percentage discounts. Auto-apply via
`?arre_coupon=CODE` on cart/checkout. Expired AI coupons are cleaned up.
