<?php
/**
 * Lightweight, async front-end event tracking.
 *
 * Loads a small deferred script only when visitor tracking is active. The
 * script batches events and posts them to the plugin's own REST endpoint
 * (same-origin, nonce-protected); the server then forwards batches to the SaaS.
 * Nothing here blocks page rendering, and admins can be excluded.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Tracker {

	public function register(): void {
		add_action( 'wp_enqueue_scripts', array( $this, 'maybe_enqueue' ) );
	}

	public function maybe_enqueue(): void {
		if ( is_admin() ) {
			return;
		}
		if ( ! ARRE_License::feature_enabled( 'visitor_tracking' ) ) {
			return;
		}
		// Respect the "exclude admins" setting.
		if ( ARRE_Settings::get( 'exclude_admins' ) && current_user_can( 'manage_options' ) ) {
			return;
		}

		wp_register_script(
			'arre-tracker',
			ARRE_PLUGIN_URL . 'assets/js/tracker.js',
			array(),
			ARRE_VERSION,
			array(
				'strategy'  => 'defer',
				'in_footer' => true,
			)
		);

		wp_localize_script(
			'arre-tracker',
			'ARRE_TRACK',
			array(
				'endpoint'    => esc_url_raw( rest_url( 'arre/v1/track' ) ),
				'nonce'       => wp_create_nonce( 'wp_rest' ),
				'storeId'     => (string) ARRE_Settings::get( 'store_id' ),
				'consentMode' => (string) ARRE_Settings::get( 'consent_mode' ),
				'isUser'      => is_user_logged_in() ? 1 : 0,
				'batchMs'     => 4000,
			)
		);

		wp_enqueue_script( 'arre-tracker' );
	}
}
