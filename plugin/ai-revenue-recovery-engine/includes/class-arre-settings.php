<?php
/**
 * Settings + connection state storage.
 *
 * Connection settings live in a single option array. The signing secret is
 * stored separately and never exposed in any admin output or REST response.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Settings {

	private const OPTION       = 'arre_settings';
	private const SECRET_OPTION = 'arre_signing_secret';
	private const TOGGLES      = 'arre_feature_toggles';

	private static ?array $cache = null;

	public static function defaults(): array {
		return array(
			'store_id'     => '',
			'license_key'  => '',
			'api_base'     => ARRE_DEFAULT_API_BASE,
			'connected'    => false,
			'debug'        => false,
			'exclude_admins' => true,
			'consent_mode' => 'implied', // 'implied' | 'explicit'
			'sync_frequency' => 'hourly',
		);
	}

	private static function all(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			self::$cache = wp_parse_args( is_array( $stored ) ? $stored : array(), self::defaults() );
		}
		return self::$cache;
	}

	public static function get( string $key ) {
		$all = self::all();
		return $all[ $key ] ?? null;
	}

	/**
	 * Persist a sanitized subset of settings.
	 *
	 * @param array $values Raw input (already unslashed by caller).
	 */
	public static function update( array $values ): void {
		$current = self::all();
		$clean   = $current;

		if ( isset( $values['store_id'] ) ) {
			$clean['store_id'] = sanitize_text_field( $values['store_id'] );
		}
		if ( isset( $values['license_key'] ) ) {
			$clean['license_key'] = sanitize_text_field( $values['license_key'] );
		}
		if ( isset( $values['api_base'] ) ) {
			$clean['api_base'] = esc_url_raw( $values['api_base'] );
		}
		if ( isset( $values['connected'] ) ) {
			$clean['connected'] = (bool) $values['connected'];
		}
		if ( isset( $values['debug'] ) ) {
			$clean['debug'] = (bool) $values['debug'];
		}
		if ( isset( $values['exclude_admins'] ) ) {
			$clean['exclude_admins'] = (bool) $values['exclude_admins'];
		}
		if ( isset( $values['consent_mode'] ) ) {
			$clean['consent_mode'] = in_array( $values['consent_mode'], array( 'implied', 'explicit' ), true )
				? $values['consent_mode'] : 'implied';
		}
		if ( isset( $values['sync_frequency'] ) ) {
			$clean['sync_frequency'] = sanitize_key( $values['sync_frequency'] );
		}

		update_option( self::OPTION, $clean, false );
		self::$cache = $clean;
	}

	public static function get_api_base(): string {
		$base = (string) self::get( 'api_base' );
		return $base !== '' ? $base : ARRE_DEFAULT_API_BASE;
	}

	/* ---- Signing secret (kept out of the main option + never echoed) ---- */

	public static function get_secret(): string {
		return (string) get_option( self::SECRET_OPTION, '' );
	}

	public static function set_secret( string $secret ): void {
		update_option( self::SECRET_OPTION, $secret, false );
	}

	public static function is_connected(): bool {
		return (bool) self::get( 'connected' )
			&& '' !== (string) self::get( 'store_id' )
			&& '' !== self::get_secret();
	}

	/* ---- Local feature toggles (FeatureId => bool) ---- */

	public static function get_toggles(): array {
		$stored = get_option( self::TOGGLES, array() );
		return is_array( $stored ) ? $stored : array();
	}

	public static function set_toggle( string $feature_id, bool $enabled ): void {
		$toggles                 = self::get_toggles();
		$toggles[ $feature_id ] = $enabled;
		update_option( self::TOGGLES, $toggles, false );
	}

	/**
	 * A feature is locally enabled unless the merchant explicitly turned it off.
	 */
	public static function is_toggled_on( string $feature_id ): bool {
		$toggles = self::get_toggles();
		return ! array_key_exists( $feature_id, $toggles ) || (bool) $toggles[ $feature_id ];
	}

	/**
	 * Remove all plugin data (used by uninstall + reset).
	 */
	public static function purge(): void {
		delete_option( self::OPTION );
		delete_option( self::SECRET_OPTION );
		delete_option( self::TOGGLES );
		delete_option( 'arre_license_cache' );
	}
}
