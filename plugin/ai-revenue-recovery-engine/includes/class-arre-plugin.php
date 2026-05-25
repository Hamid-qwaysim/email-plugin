<?php
/**
 * Plugin bootstrap (singleton). Wires subsystems and schedules background work.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Plugin {

	private static ?ARRE_Plugin $instance = null;

	public const CRON_KILL_SWITCH = 'arre_cron_kill_switch';
	public const CRON_VALIDATE    = 'arre_cron_validate';
	public const CRON_SYNC        = 'arre_cron_sync';

	public static function instance(): ARRE_Plugin {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function boot(): void {
		load_plugin_textdomain( 'ai-revenue-recovery-engine', false, dirname( ARRE_PLUGIN_BASENAME ) . '/languages' );

		// Admin UI.
		if ( is_admin() ) {
			( new ARRE_Admin() )->register();
		}

		// Internal REST (tracker → WP → SaaS batching).
		add_action( 'rest_api_init', array( new ARRE_Rest(), 'register_routes' ) );

		// Background schedules.
		add_action( self::CRON_KILL_SWITCH, array( ARRE_License::class, 'check_kill_switch' ) );
		add_action( self::CRON_VALIDATE, array( ARRE_License::class, 'refresh' ) );
		add_action( self::CRON_SYNC, array( ARRE_Sync::class, 'run_incremental' ) );
		$this->ensure_schedules();

		// Premium subsystems run only while the license allows them. Each one
		// internally re-checks its own feature flag, so a mid-request kill is
		// still respected by the next hook.
		if ( ARRE_Settings::is_connected() ) {
			( new ARRE_Tracker() )->register();
			( new ARRE_WooCommerce() )->register();
			( new ARRE_Coupons() )->register();
		}

		// Show an admin banner whenever premium features are paused.
		add_action( 'admin_notices', array( $this, 'maybe_inactive_notice' ) );
	}

	/**
	 * Surface the paused-state message required by the spec.
	 */
	public function maybe_inactive_notice(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( ! ARRE_Settings::is_connected() || ARRE_License::is_active() ) {
			return;
		}
		printf(
			'<div class="notice notice-warning"><p><strong>%s</strong> %s</p></div>',
			esc_html__( 'AI Revenue Recovery Engine:', 'ai-revenue-recovery-engine' ),
			esc_html(
				sprintf(
					/* translators: %s: reason the license is inactive. */
					__( 'Your license is inactive. Premium features are paused. (%s)', 'ai-revenue-recovery-engine' ),
					ARRE_License::reason()
				)
			)
		);
	}

	/**
	 * Register custom cron intervals + schedule recurring events.
	 * Prefers Action Scheduler when available (bundled with WooCommerce).
	 */
	private function ensure_schedules(): void {
		add_filter(
			'cron_schedules',
			static function ( array $schedules ): array {
				$schedules['arre_two_minutes'] = array(
					'interval' => 120,
					'display'  => __( 'Every 2 minutes (ARRE)', 'ai-revenue-recovery-engine' ),
				);
				return $schedules;
			}
		);

		if ( function_exists( 'as_has_scheduled_action' ) ) {
			if ( ! as_has_scheduled_action( self::CRON_KILL_SWITCH ) ) {
				as_schedule_recurring_action( time() + 120, 120, self::CRON_KILL_SWITCH, array(), 'arre' );
			}
			if ( ! as_has_scheduled_action( self::CRON_VALIDATE ) ) {
				as_schedule_recurring_action( time() + 300, 900, self::CRON_VALIDATE, array(), 'arre' );
			}
			if ( ! as_has_scheduled_action( self::CRON_SYNC ) ) {
				as_schedule_recurring_action( time() + 600, HOUR_IN_SECONDS, self::CRON_SYNC, array(), 'arre' );
			}
			return;
		}

		// Fallback to wp-cron.
		if ( ! wp_next_scheduled( self::CRON_KILL_SWITCH ) ) {
			wp_schedule_event( time() + 120, 'arre_two_minutes', self::CRON_KILL_SWITCH );
		}
		if ( ! wp_next_scheduled( self::CRON_VALIDATE ) ) {
			wp_schedule_event( time() + 300, 'hourly', self::CRON_VALIDATE );
		}
		if ( ! wp_next_scheduled( self::CRON_SYNC ) ) {
			wp_schedule_event( time() + 600, 'hourly', self::CRON_SYNC );
		}
	}

	public static function activate(): void {
		// Schedules are (re)created on boot; nothing destructive here.
		if ( ! get_option( 'arre_settings' ) ) {
			add_option( 'arre_settings', ARRE_Settings::defaults(), '', false );
		}
	}

	public static function deactivate(): void {
		foreach ( array( self::CRON_KILL_SWITCH, self::CRON_VALIDATE, self::CRON_SYNC ) as $hook ) {
			$ts = wp_next_scheduled( $hook );
			if ( $ts ) {
				wp_unschedule_event( $ts, $hook );
			}
			if ( function_exists( 'as_unschedule_all_actions' ) ) {
				as_unschedule_all_actions( $hook, array(), 'arre' );
			}
		}
	}
}
