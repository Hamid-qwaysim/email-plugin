<?php
/**
 * Plugin Name:       AI Revenue Recovery Engine for WooCommerce
 * Plugin URI:        https://airevenuerecovery.com
 * Description:       Recover abandoned carts, generate smart AI coupons, and automate store marketing. Connects to the AI Revenue Recovery Engine SaaS via a license key.
 * Version:           0.1.0
 * Requires at least: 6.3
 * Requires PHP:      8.1
 * Author:            AI Revenue Recovery Engine
 * License:           GPL-2.0-or-later
 * Text Domain:       ai-revenue-recovery-engine
 * WC requires at least: 7.0
 * WC tested up to:   9.5
 *
 * @package ARRE
 */

declare( strict_types=1 );

// No direct file access.
defined( 'ABSPATH' ) || exit;

define( 'ARRE_VERSION', '0.1.0' );
define( 'ARRE_PLUGIN_FILE', __FILE__ );
define( 'ARRE_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'ARRE_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'ARRE_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Default SaaS API endpoint (overridable on the Advanced settings page).
if ( ! defined( 'ARRE_DEFAULT_API_BASE' ) ) {
	define( 'ARRE_DEFAULT_API_BASE', 'https://api.airevenuerecovery.com/v1' );
}

/**
 * Declare HPOS (High-Performance Order Storage) compatibility.
 * Must run before WooCommerce initializes.
 */
add_action(
	'before_woocommerce_init',
	static function (): void {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', ARRE_PLUGIN_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', ARRE_PLUGIN_FILE, true );
		}
	}
);

// PSR-style autoloader for the plugin's own classes (ARRE_ prefix).
spl_autoload_register(
	static function ( string $class ): void {
		if ( ! str_starts_with( $class, 'ARRE_' ) ) {
			return;
		}
		$slug = 'class-' . str_replace( '_', '-', strtolower( $class ) ) . '.php';
		foreach ( array( 'includes/', 'includes/admin/' ) as $dir ) {
			$path = ARRE_PLUGIN_DIR . $dir . $slug;
			if ( is_readable( $path ) ) {
				require_once $path;
				return;
			}
		}
	}
);

/**
 * Boot the plugin once all plugins are loaded, but only if WooCommerce is active.
 */
add_action(
	'plugins_loaded',
	static function (): void {
		if ( ! class_exists( 'WooCommerce' ) ) {
			add_action(
				'admin_notices',
				static function (): void {
					echo '<div class="notice notice-error"><p>';
					echo esc_html__( 'AI Revenue Recovery Engine requires WooCommerce to be installed and active.', 'ai-revenue-recovery-engine' );
					echo '</p></div>';
				}
			);
			return;
		}
		ARRE_Plugin::instance()->boot();
	}
);

// Activation / deactivation lifecycle.
register_activation_hook(
	__FILE__,
	static function (): void {
		require_once ARRE_PLUGIN_DIR . 'includes/class-arre-plugin.php';
		ARRE_Plugin::activate();
	}
);

register_deactivation_hook(
	__FILE__,
	static function (): void {
		require_once ARRE_PLUGIN_DIR . 'includes/class-arre-plugin.php';
		ARRE_Plugin::deactivate();
	}
);
