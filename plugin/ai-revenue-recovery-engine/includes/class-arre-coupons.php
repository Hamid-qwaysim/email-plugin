<?php
/**
 * Creates real WooCommerce coupons from SaaS coupon decisions and (optionally)
 * auto-applies them at checkout. Respects local toggles + the max-discount
 * guard before ever writing a coupon.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Coupons {

	public function register(): void {
		// Allow the SaaS-issued coupon to auto-apply via a URL/session flag.
		add_action( 'woocommerce_before_cart', array( $this, 'maybe_auto_apply' ) );
		add_action( 'woocommerce_before_checkout_form', array( $this, 'maybe_auto_apply' ) );
	}

	/**
	 * Materialize a coupon decision (from the SaaS) as a WooCommerce coupon.
	 *
	 * @param array $decision {
	 *   code, type ('percent'|'fixed_cart'|'fixed_product'), amount (string|float),
	 *   email (string|null), minCents (int|null), expiresAt (int|null), usageLimit (int)
	 * }
	 * @return int|WP_Error Coupon post id or error.
	 */
	public function create_from_decision( array $decision ) {
		if ( ! ARRE_License::feature_enabled( 'ai_coupon_engine' ) ) {
			return new WP_Error( 'arre_disabled', __( 'Coupon engine is disabled.', 'ai-revenue-recovery-engine' ) );
		}

		$code = isset( $decision['code'] ) ? wc_format_coupon_code( sanitize_text_field( (string) $decision['code'] ) ) : '';
		if ( '' === $code ) {
			return new WP_Error( 'arre_no_code', __( 'Coupon code is required.', 'ai-revenue-recovery-engine' ) );
		}
		if ( wc_get_coupon_id_by_code( $code ) ) {
			return new WP_Error( 'arre_exists', __( 'Coupon already exists.', 'ai-revenue-recovery-engine' ) );
		}

		$type = isset( $decision['type'] ) ? sanitize_key( (string) $decision['type'] ) : 'percent';
		$allowed_types = array( 'percent', 'fixed_cart', 'fixed_product' );
		if ( ! in_array( $type, $allowed_types, true ) ) {
			$type = 'percent';
		}

		$amount = isset( $decision['amount'] ) ? (float) $decision['amount'] : 0.0;
		// Profit guard: never exceed the locally configured max discount percent.
		if ( 'percent' === $type ) {
			$max = (float) apply_filters( 'arre_max_discount_percent', 25.0 );
			$amount = min( $amount, $max );
		}

		$coupon = new WC_Coupon();
		$coupon->set_code( $code );
		$coupon->set_discount_type( $type );
		$coupon->set_amount( $amount );
		$coupon->set_individual_use( true );
		$coupon->set_usage_limit( isset( $decision['usageLimit'] ) ? absint( $decision['usageLimit'] ) : 1 );

		if ( ! empty( $decision['email'] ) && is_email( (string) $decision['email'] ) ) {
			$coupon->set_email_restrictions( array( sanitize_email( (string) $decision['email'] ) ) );
		}
		if ( isset( $decision['minCents'] ) ) {
			$coupon->set_minimum_amount( (string) ( absint( $decision['minCents'] ) / 100 ) );
		}
		if ( ! empty( $decision['expiresAt'] ) ) {
			$coupon->set_date_expires( absint( $decision['expiresAt'] ) );
		}

		$coupon->update_meta_data( '_arre_generated', '1' );
		$coupon->save();

		return $coupon->get_id();
	}

	/**
	 * Auto-apply a coupon code passed via ?arre_coupon=CODE (set by recovery links).
	 */
	public function maybe_auto_apply(): void {
		if ( ! ARRE_License::feature_enabled( 'ai_coupon_engine' ) ) {
			return;
		}
		// Read-only intent from the URL; sanitized and validated against a real coupon.
		$code = isset( $_GET['arre_coupon'] ) ? wc_format_coupon_code( sanitize_text_field( wp_unslash( (string) $_GET['arre_coupon'] ) ) ) : '';
		if ( '' === $code || ! function_exists( 'WC' ) || ! WC()->cart ) {
			return;
		}
		if ( ! wc_get_coupon_id_by_code( $code ) ) {
			return;
		}
		if ( ! WC()->cart->has_discount( $code ) ) {
			WC()->cart->apply_coupon( $code );
		}
	}

	/**
	 * Remove expired AI-generated coupons (called from sync). Optional cleanup.
	 */
	public static function cleanup_expired(): int {
		$removed = 0;
		$query   = new WP_Query(
			array(
				'post_type'      => 'shop_coupon',
				'post_status'    => 'publish',
				'posts_per_page' => 100,
				'meta_key'       => '_arre_generated',
				'meta_value'     => '1',
				'fields'         => 'ids',
				'no_found_rows'  => true,
			)
		);
		foreach ( $query->posts as $coupon_id ) {
			$coupon  = new WC_Coupon( (int) $coupon_id );
			$expires = $coupon->get_date_expires();
			if ( $expires && $expires->getTimestamp() < time() ) {
				wp_delete_post( (int) $coupon_id, true );
				++$removed;
			}
		}
		return $removed;
	}
}
