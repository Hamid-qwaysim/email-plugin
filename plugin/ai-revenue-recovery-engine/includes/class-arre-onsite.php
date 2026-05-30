<?php
/**
 * On-site personalization renderer (#9, #10, #17). Fetches the active onsite
 * elements (popups, top bars, exit-intent offers, lead forms) from the SaaS,
 * caches them briefly, and enqueues a tiny renderer that applies targeting +
 * frequency caps client-side. Only loads when the feature is active.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Onsite {

	private const CACHE = 'arre_onsite_cache';

	public function register(): void {
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue' ) );
	}

	public function maybe_enqueue(): void {
		if ( is_admin() || ! ARRE_License::feature_enabled( 'onsite_personalization' ) ) {
			return;
		}
		if ( ARRE_Settings::get( 'exclude_admins' ) && current_user_can( 'manage_options' ) ) {
			return;
		}

		$elements = $this->get_elements();
		if ( empty( $elements ) ) {
			return;
		}

		wp_register_script(
			'arre-onsite',
			ARRE_PLUGIN_URL . 'assets/js/onsite.js',
			array(),
			ARRE_VERSION,
			array( 'strategy' => 'defer', 'in_footer' => true )
		);
		wp_localize_script(
			'arre-onsite',
			'ARRE_ONSITE',
			array(
				'elements' => $elements,
				'path'     => esc_js( wp_parse_url( home_url( add_query_arg( array() ) ), PHP_URL_PATH ) ?? '/' ),
			)
		);
		wp_enqueue_script( 'arre-onsite' );
	}

	/**
	 * Fetch onsite elements from the SaaS (cached for 5 minutes).
	 *
	 * @return array<int,array<string,mixed>>
	 */
	private function get_elements(): array {
		$cached = get_transient( self::CACHE );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return array();
		}
		$res = $client->get( '/plugin/onsite' );
		if ( ! $res->ok() ) {
			return array();
		}
		$payload = $res->payload();
		$popups  = isset( $payload['popups'] ) && is_array( $payload['popups'] ) ? $payload['popups'] : array();

		// Normalize for the client renderer (decode JSON columns safely).
		$elements = array();
		foreach ( $popups as $p ) {
			if ( ! is_array( $p ) ) {
				continue;
			}
			$elements[] = array(
				'id'        => isset( $p['id'] ) ? sanitize_text_field( (string) $p['id'] ) : '',
				'kind'      => isset( $p['kind'] ) ? sanitize_key( (string) $p['kind'] ) : 'popup',
				'content'   => isset( $p['content'] ) ? json_decode( (string) $p['content'], true ) : array(),
				'design'    => isset( $p['design'] ) ? json_decode( (string) $p['design'], true ) : array(),
				'frequency' => isset( $p['frequency_cap'] ) ? json_decode( (string) $p['frequency_cap'], true ) : array(),
			);
		}

		set_transient( self::CACHE, $elements, 5 * MINUTE_IN_SECONDS );
		return $elements;
	}
}
