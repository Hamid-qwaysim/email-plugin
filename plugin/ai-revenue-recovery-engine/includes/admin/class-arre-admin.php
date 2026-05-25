<?php
/**
 * Admin menu, settings pages, and secure form handling.
 *
 * Security model on every write:
 *   - current_user_can( 'manage_woocommerce' )
 *   - check_admin_referer() with a per-form nonce
 *   - sanitize every input, escape every output
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Admin {

	private const CAP  = 'manage_woocommerce';
	private const SLUG = 'arre';

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'handle_post' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );
	}

	public function menu(): void {
		add_menu_page(
			__( 'AI Revenue Recovery', 'ai-revenue-recovery-engine' ),
			__( 'AI Revenue', 'ai-revenue-recovery-engine' ),
			self::CAP,
			self::SLUG,
			array( $this, 'render_connection' ),
			'dashicons-chart-line',
			56
		);

		$pages = array(
			'arre'            => array( __( 'Connection', 'ai-revenue-recovery-engine' ), 'render_connection' ),
			'arre-license'    => array( __( 'License', 'ai-revenue-recovery-engine' ), 'render_license' ),
			'arre-features'   => array( __( 'Features', 'ai-revenue-recovery-engine' ), 'render_features' ),
			'arre-sync'       => array( __( 'WooCommerce Sync', 'ai-revenue-recovery-engine' ), 'render_sync' ),
			'arre-diagnostics'=> array( __( 'Diagnostics', 'ai-revenue-recovery-engine' ), 'render_diagnostics' ),
			'arre-advanced'   => array( __( 'Advanced', 'ai-revenue-recovery-engine' ), 'render_advanced' ),
		);
		foreach ( $pages as $slug => $page ) {
			add_submenu_page( self::SLUG, $page[0], $page[0], self::CAP, $slug, array( $this, $page[1] ) );
		}
	}

	public function assets( string $hook ): void {
		if ( false === strpos( $hook, 'arre' ) ) {
			return;
		}
		wp_enqueue_style( 'arre-admin', ARRE_PLUGIN_URL . 'assets/css/admin.css', array(), ARRE_VERSION );
	}

	/**
	 * Central POST router. Each action verifies capability + nonce first.
	 */
	public function handle_post(): void {
		if ( empty( $_POST['arre_action'] ) ) {
			return;
		}
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( esc_html__( 'You are not allowed to do that.', 'ai-revenue-recovery-engine' ) );
		}
		$action = sanitize_key( wp_unslash( (string) $_POST['arre_action'] ) );

		switch ( $action ) {
			case 'connect':
				check_admin_referer( 'arre_connect' );
				$this->do_connect();
				break;
			case 'recheck':
				check_admin_referer( 'arre_recheck' );
				ARRE_License::refresh();
				$this->redirect( 'arre-license', 'rechecked' );
				break;
			case 'deactivate':
				check_admin_referer( 'arre_deactivate' );
				ARRE_License::deactivate();
				ARRE_Settings::update( array( 'connected' => false ) );
				$this->redirect( 'arre-license', 'deactivated' );
				break;
			case 'save_features':
				check_admin_referer( 'arre_features' );
				$this->do_save_features();
				break;
			case 'save_advanced':
				check_admin_referer( 'arre_advanced' );
				$this->do_save_advanced();
				break;
			case 'full_sync':
				check_admin_referer( 'arre_sync' );
				ARRE_Sync::full_sync();
				$this->redirect( 'arre-sync', 'syncing' );
				break;
			case 'reset':
				check_admin_referer( 'arre_reset' );
				ARRE_Settings::purge();
				$this->redirect( 'arre-advanced', 'reset' );
				break;
		}
	}

	private function do_connect(): void {
		$store_id = isset( $_POST['arre_store_id'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['arre_store_id'] ) ) : '';
		$license  = isset( $_POST['arre_license_key'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['arre_license_key'] ) ) : '';
		$secret   = isset( $_POST['arre_signing_secret'] ) ? sanitize_text_field( wp_unslash( (string) $_POST['arre_signing_secret'] ) ) : '';

		if ( '' === $store_id || '' === $license || '' === $secret ) {
			$this->redirect( 'arre', 'missing' );
			return;
		}

		ARRE_Settings::update(
			array(
				'store_id'    => $store_id,
				'license_key' => $license,
				'connected'   => true,
			)
		);
		ARRE_Settings::set_secret( $secret );

		// Bind this domain + validate.
		$activate = ARRE_License::activate();
		if ( ! $activate->ok() ) {
			ARRE_Settings::update( array( 'connected' => false ) );
			$this->redirect( 'arre', 'failed' );
			return;
		}
		$this->redirect( 'arre', 'connected' );
	}

	private function do_save_features(): void {
		$toggles = isset( $_POST['arre_toggle'] ) && is_array( $_POST['arre_toggle'] )
			? wp_unslash( $_POST['arre_toggle'] )
			: array();

		foreach ( ARRE_Admin::toggleable_features() as $feature_id => $label ) {
			$on = isset( $toggles[ $feature_id ] );
			ARRE_Settings::set_toggle( $feature_id, $on );
		}
		$this->redirect( 'arre-features', 'saved' );
	}

	private function do_save_advanced(): void {
		$api_base = isset( $_POST['arre_api_base'] ) ? esc_url_raw( wp_unslash( (string) $_POST['arre_api_base'] ) ) : '';
		ARRE_Settings::update(
			array(
				'api_base'       => $api_base ?: ARRE_DEFAULT_API_BASE,
				'debug'          => ! empty( $_POST['arre_debug'] ),
				'exclude_admins' => ! empty( $_POST['arre_exclude_admins'] ),
				'consent_mode'   => isset( $_POST['arre_consent_mode'] ) ? sanitize_key( wp_unslash( (string) $_POST['arre_consent_mode'] ) ) : 'implied',
			)
		);
		$this->redirect( 'arre-advanced', 'saved' );
	}

	private function redirect( string $page, string $notice ): void {
		wp_safe_redirect( add_query_arg( array( 'page' => $page, 'arre_notice' => $notice ), admin_url( 'admin.php' ) ) );
		exit;
	}

	/** Features the merchant can toggle locally. */
	public static function toggleable_features(): array {
		return array(
			'visitor_tracking'        => __( 'Visitor tracking', 'ai-revenue-recovery-engine' ),
			'abandoned_cart_recovery' => __( 'Abandoned cart recovery', 'ai-revenue-recovery-engine' ),
			'ai_coupon_engine'        => __( 'AI coupons', 'ai-revenue-recovery-engine' ),
			'email_autopilot'         => __( 'Email autopilot', 'ai-revenue-recovery-engine' ),
			'onsite_personalization'  => __( 'On-site popups', 'ai-revenue-recovery-engine' ),
			'exit_intent_offers'      => __( 'Exit intent offers', 'ai-revenue-recovery-engine' ),
			'product_recommendations' => __( 'Product recommendations', 'ai-revenue-recovery-engine' ),
			'browse_abandonment'      => __( 'Browse abandonment', 'ai-revenue-recovery-engine' ),
			'checkout_friction'       => __( 'Checkout friction tracking', 'ai-revenue-recovery-engine' ),
			'multichannel_automation' => __( 'Web push / WhatsApp-ready', 'ai-revenue-recovery-engine' ),
		);
	}

	/* ----------------------------- Views ----------------------------- */

	private function view( string $name, array $data = array() ): void {
		$file = ARRE_PLUGIN_DIR . 'includes/admin/views/' . $name . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}

	public function render_connection(): void { $this->view( 'connection' ); }
	public function render_license(): void { $this->view( 'license' ); }
	public function render_features(): void { $this->view( 'features', array( 'features' => self::toggleable_features() ) ); }
	public function render_sync(): void { $this->view( 'sync' ); }
	public function render_diagnostics(): void { $this->view( 'diagnostics', array( 'snapshot' => ARRE_Diagnostics::snapshot() ) ); }
	public function render_advanced(): void { $this->view( 'advanced' ); }

	public static function notice(): void {
		$notice = isset( $_GET['arre_notice'] ) ? sanitize_key( wp_unslash( (string) $_GET['arre_notice'] ) ) : '';
		if ( '' === $notice ) {
			return;
		}
		$map = array(
			'connected'   => array( 'success', __( 'Connected successfully.', 'ai-revenue-recovery-engine' ) ),
			'failed'      => array( 'error', __( 'Could not activate the license. Check your details.', 'ai-revenue-recovery-engine' ) ),
			'missing'     => array( 'error', __( 'Store ID, license key and signing secret are all required.', 'ai-revenue-recovery-engine' ) ),
			'rechecked'   => array( 'success', __( 'License re-checked.', 'ai-revenue-recovery-engine' ) ),
			'deactivated' => array( 'info', __( 'License deactivated on this site.', 'ai-revenue-recovery-engine' ) ),
			'saved'       => array( 'success', __( 'Settings saved.', 'ai-revenue-recovery-engine' ) ),
			'syncing'     => array( 'info', __( 'Full sync scheduled.', 'ai-revenue-recovery-engine' ) ),
			'reset'       => array( 'info', __( 'Plugin data reset.', 'ai-revenue-recovery-engine' ) ),
		);
		if ( ! isset( $map[ $notice ] ) ) {
			return;
		}
		printf(
			'<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
			esc_attr( $map[ $notice ][0] ),
			esc_html( $map[ $notice ][1] )
		);
	}
}
