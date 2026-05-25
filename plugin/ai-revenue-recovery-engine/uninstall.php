<?php
/**
 * Uninstall cleanup. Only runs when the user deletes the plugin from WP admin.
 * Removes plugin options, the signing secret, cached license state, and any
 * AI-generated coupons flagged for cleanup.
 *
 * @package ARRE
 */

declare( strict_types=1 );

// Guard: only execute in a genuine uninstall context.
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Respect an opt-out: the merchant can keep data on uninstall.
$settings = get_option( 'arre_settings', array() );
$keep     = is_array( $settings ) && ! empty( $settings['keep_data_on_uninstall'] );

if ( ! $keep ) {
	delete_option( 'arre_settings' );
	delete_option( 'arre_signing_secret' );
	delete_option( 'arre_feature_toggles' );
	delete_option( 'arre_license_cache' );

	// Remove AI-generated coupons.
	$coupons = get_posts(
		array(
			'post_type'      => 'shop_coupon',
			'post_status'    => 'any',
			'numberposts'    => -1,
			'fields'         => 'ids',
			'meta_key'       => '_arre_generated',
			'meta_value'     => '1',
		)
	);
	foreach ( $coupons as $coupon_id ) {
		wp_delete_post( (int) $coupon_id, true );
	}
}
