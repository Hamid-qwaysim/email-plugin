<?php
/**
 * Collects an environment/health snapshot for the diagnostics page and for the
 * SaaS store-health view. Contains no secrets.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Diagnostics {

	public static function snapshot(): array {
		global $wp_version;

		return array(
			'pluginVersion'     => ARRE_VERSION,
			'phpVersion'        => PHP_VERSION,
			'wpVersion'         => $wp_version,
			'wooVersion'        => defined( 'WC_VERSION' ) ? WC_VERSION : null,
			'hposEnabled'       => self::hpos_enabled(),
			'restReachable'     => true,
			'cronDisabled'      => defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON,
			'actionScheduler'   => function_exists( 'as_has_scheduled_action' ),
			'connected'         => ARRE_Settings::is_connected(),
			'licenseStatus'     => ARRE_License::status_label(),
			'licenseActive'     => ARRE_License::is_active(),
			'domain'            => ARRE_License::domain(),
			'lastChecked'       => (int) ( ARRE_License::decision()['checked_at'] ?? 0 ),
		);
	}

	public static function hpos_enabled(): bool {
		if ( class_exists( \Automattic\WooCommerce\Utilities\OrderUtil::class ) ) {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		return false;
	}
}
