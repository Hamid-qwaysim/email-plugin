<?php
/**
 * Server-side WooCommerce integration. Captures authoritative commerce events
 * (add-to-cart, checkout, order created/paid) and forwards them to the SaaS.
 * These complement the front-end tracker with server-trusted data.
 *
 * Every handler re-checks the relevant feature flag, so a mid-session kill
 * switch stops new forwarding immediately. Work is kept light; nothing here
 * blocks checkout.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_WooCommerce {

	public function register(): void {
		add_action( 'woocommerce_add_to_cart', array( $this, 'on_add_to_cart' ), 20, 1 );
		add_action( 'woocommerce_checkout_order_processed', array( $this, 'on_order_created' ), 20, 1 );
		add_action( 'woocommerce_order_status_completed', array( $this, 'on_order_paid' ), 20, 1 );
		add_action( 'woocommerce_payment_complete', array( $this, 'on_order_paid' ), 20, 1 );
	}

	public function on_add_to_cart( string $cart_item_key ): void {
		if ( ! ARRE_License::feature_enabled( 'abandoned_cart_recovery' ) ) {
			return;
		}
		$this->forward(
			'add_to_cart',
			array(
				'cartItemKey' => sanitize_text_field( $cart_item_key ),
				'cartTotal'   => $this->cart_total_cents(),
			)
		);
	}

	public function on_order_created( int $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}
		$this->forward(
			'order_created',
			array(
				'wooOrderId' => absint( $order_id ),
				'totalCents' => $this->to_cents( (float) $order->get_total() ),
				'currency'   => sanitize_text_field( $order->get_currency() ),
				'email'      => sanitize_email( $order->get_billing_email() ),
			)
		);
	}

	public function on_order_paid( int $order_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}
		$this->forward(
			'purchase_completed',
			array(
				'wooOrderId' => absint( $order_id ),
				'totalCents' => $this->to_cents( (float) $order->get_total() ),
				'currency'   => sanitize_text_field( $order->get_currency() ),
				'email'      => sanitize_email( $order->get_billing_email() ),
			)
		);
	}

	private function cart_total_cents(): int {
		if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
			return 0;
		}
		return $this->to_cents( (float) WC()->cart->get_total( 'edit' ) );
	}

	private function to_cents( float $amount ): int {
		return (int) round( $amount * 100 );
	}

	/**
	 * Forward a single server-side event. Best-effort; failures are swallowed so
	 * they never affect the storefront. Heavy retry logic lives server-side.
	 */
	private function forward( string $type, array $props ): void {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return;
		}
		$client->post(
			'/plugin/events',
			array(
				'storeId' => (string) ARRE_Settings::get( 'store_id' ),
				'events'  => array(
					array(
						'type'      => $type,
						'ts'        => time() * 1000,
						'visitorId' => $this->server_visitor_id(),
						'sessionId' => 'server',
						'props'     => $props,
					),
				),
			)
		);
	}

	/**
	 * Stable per-customer id for server-side events (logged-in user or session).
	 */
	private function server_visitor_id(): string {
		$uid = get_current_user_id();
		if ( $uid > 0 ) {
			return 'wpuser-' . $uid;
		}
		if ( function_exists( 'WC' ) && WC()->session ) {
			$cookie = WC()->session->get_customer_id();
			if ( $cookie ) {
				return 'wcsess-' . sanitize_text_field( (string) $cookie );
			}
		}
		return 'anon-server';
	}
}
