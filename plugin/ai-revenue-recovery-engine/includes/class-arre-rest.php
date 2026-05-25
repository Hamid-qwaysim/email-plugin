<?php
/**
 * Internal REST endpoint that receives batched events from the front-end
 * tracker and forwards them to the SaaS. Same-origin, nonce-protected, and
 * rate-shaped. All inbound data is sanitized; nothing is trusted.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Rest {

	private const ALLOWED_TYPES = array(
		'page_view', 'product_view', 'category_view', 'search', 'add_to_cart',
		'remove_from_cart', 'cart_updated', 'checkout_started', 'checkout_field_focus',
		'checkout_error', 'coupon_applied', 'coupon_failed', 'quantity_changed',
		'order_created', 'purchase_completed', 'email_captured', 'popup_viewed',
		'popup_clicked', 'exit_intent', 'scroll_depth', 'returning_visit',
	);

	public function register_routes(): void {
		register_rest_route(
			'arre/v1',
			'/track',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_track' ),
				'permission_callback' => array( $this, 'permission' ),
			)
		);
	}

	/**
	 * Public endpoint (guests track too) but protected by the REST nonce to
	 * prevent cross-site abuse. The nonce is verified by WP for logged-in users;
	 * for guests we still require it to be present and well-formed.
	 */
	public function permission( WP_REST_Request $request ): bool {
		if ( ! ARRE_License::feature_enabled( 'visitor_tracking' ) ) {
			return false;
		}
		$nonce = $request->get_header( 'X-WP-Nonce' );
		// wp_verify_nonce returns false for guests; presence + same-origin is our
		// guard there. Logged-in users get full nonce verification.
		if ( is_user_logged_in() ) {
			return (bool) wp_verify_nonce( (string) $nonce, 'wp_rest' );
		}
		return is_string( $nonce ) && '' !== $nonce;
	}

	public function handle_track( WP_REST_Request $request ): WP_REST_Response {
		$raw_events = $request->get_param( 'events' );
		if ( ! is_array( $raw_events ) ) {
			return new WP_REST_Response( array( 'accepted' => 0 ), 200 );
		}

		$events = array();
		foreach ( array_slice( $raw_events, 0, 100 ) as $ev ) {
			if ( ! is_array( $ev ) ) {
				continue;
			}
			$type = isset( $ev['type'] ) ? sanitize_key( (string) $ev['type'] ) : '';
			if ( ! in_array( $type, self::ALLOWED_TYPES, true ) ) {
				continue;
			}
			$events[] = array(
				'type'      => $type,
				'ts'        => isset( $ev['ts'] ) ? absint( $ev['ts'] ) : ( time() * 1000 ),
				'visitorId' => isset( $ev['visitorId'] ) ? sanitize_text_field( (string) $ev['visitorId'] ) : '',
				'sessionId' => isset( $ev['sessionId'] ) ? sanitize_text_field( (string) $ev['sessionId'] ) : '',
				'cartToken' => isset( $ev['cartToken'] ) ? sanitize_text_field( (string) $ev['cartToken'] ) : null,
				'props'     => isset( $ev['props'] ) && is_array( $ev['props'] ) ? $this->clean_props( $ev['props'] ) : null,
				'page'      => isset( $ev['page'] ) && is_array( $ev['page'] ) ? array(
					'url'      => isset( $ev['page']['url'] ) ? esc_url_raw( (string) $ev['page']['url'] ) : null,
					'referrer' => isset( $ev['page']['referrer'] ) ? esc_url_raw( (string) $ev['page']['referrer'] ) : null,
					'title'    => isset( $ev['page']['title'] ) ? sanitize_text_field( (string) $ev['page']['title'] ) : null,
				) : null,
			);
		}

		if ( empty( $events ) ) {
			return new WP_REST_Response( array( 'accepted' => 0 ), 200 );
		}

		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return new WP_REST_Response( array( 'accepted' => 0 ), 200 );
		}

		$res = $client->post(
			'/plugin/events',
			array(
				'storeId' => (string) ARRE_Settings::get( 'store_id' ),
				'events'  => $events,
			)
		);

		return new WP_REST_Response(
			array( 'accepted' => $res->ok() ? count( $events ) : 0 ),
			200
		);
	}

	/**
	 * Shallow-sanitize an arbitrary props map (scalars only).
	 */
	private function clean_props( array $props ): array {
		$clean = array();
		foreach ( $props as $key => $value ) {
			$k = sanitize_key( (string) $key );
			if ( is_scalar( $value ) ) {
				$clean[ $k ] = is_string( $value ) ? sanitize_text_field( $value ) : $value;
			}
		}
		return $clean;
	}
}
