<?php
/**
 * License state + the local kill switch.
 *
 * The plugin caches the SaaS decision in a transient for a server-provided TTL,
 * but ALWAYS re-checks a cheap kill-switch endpoint on a short schedule. The
 * moment the SaaS reports inactive (expired, canceled, suspended, or admin
 * kill switch), every premium feature stops. Non-premium surfaces (the admin
 * status pages) keep working so the merchant can see why and reconnect.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_License {

	private const CACHE_OPTION = 'arre_license_cache';
	/** Hard ceiling on how long a positive decision is trusted offline. */
	private const MAX_TRUST_SECONDS = 21600; // 6h

	private static ?array $decision = null;

	/**
	 * The cached decision array:
	 *  active, status, reason, entitlements[], inGracePeriod, checked_at, ttl
	 */
	public static function decision(): array {
		if ( null !== self::$decision ) {
			return self::$decision;
		}
		$cached = get_option( self::CACHE_OPTION, array() );
		if ( ! is_array( $cached ) || empty( $cached ) ) {
			$cached = self::inactive_decision( __( 'Not connected.', 'ai-revenue-recovery-engine' ) );
		}
		self::$decision = $cached;
		return $cached;
	}

	public static function is_active(): bool {
		$d = self::decision();
		if ( empty( $d['active'] ) ) {
			return false;
		}
		// Defensive offline expiry: never trust a positive decision forever.
		$checked = (int) ( $d['checked_at'] ?? 0 );
		$ttl     = min( (int) ( $d['ttl'] ?? 0 ), self::MAX_TRUST_SECONDS );
		if ( $checked > 0 && ( time() - $checked ) > $ttl + 60 ) {
			// Stale: force a quick recheck; treat as inactive until refreshed.
			self::refresh();
			return ! empty( self::decision()['active'] );
		}
		return true;
	}

	/**
	 * Is a specific premium feature available right now?
	 * Requires: license active AND plan entitled AND local toggle on.
	 */
	public static function feature_enabled( string $feature_id ): bool {
		if ( ! self::is_active() ) {
			return false;
		}
		$d = self::decision();
		$entitlements = isset( $d['entitlements'] ) && is_array( $d['entitlements'] ) ? $d['entitlements'] : array();
		if ( ! in_array( $feature_id, $entitlements, true ) ) {
			return false;
		}
		return ARRE_Settings::is_toggled_on( $feature_id );
	}

	public static function status_label(): string {
		$d = self::decision();
		return (string) ( $d['status'] ?? 'unknown' );
	}

	public static function reason(): string {
		$d = self::decision();
		return (string) ( $d['reason'] ?? '' );
	}

	/**
	 * Full validation against the SaaS. Stores the decision + TTL.
	 */
	public static function refresh(): array {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return self::store( self::inactive_decision( __( 'Not connected.', 'ai-revenue-recovery-engine' ) ) );
		}

		$res = $client->get( '/plugin/license/validate' );
		if ( ! $res->ok() ) {
			// On transient errors keep the last good decision but shorten its life.
			$current = self::decision();
			if ( ! empty( $current['active'] ) ) {
				$current['ttl'] = 120;
				$current['checked_at'] = time();
				return self::store( $current );
			}
			return self::store( self::inactive_decision( $res->error_message() ) );
		}

		$p = $res->payload();
		$decision = array(
			'active'        => ! empty( $p['active'] ),
			'status'        => (string) ( $p['status'] ?? 'unknown' ),
			'reason'        => (string) ( $p['reason'] ?? '' ),
			'entitlements'  => isset( $p['entitlements'] ) && is_array( $p['entitlements'] ) ? array_map( 'strval', $p['entitlements'] ) : array(),
			'inGracePeriod' => ! empty( $p['inGracePeriod'] ),
			'ttl'           => (int) ( $p['cacheTtlSeconds'] ?? 300 ),
			'checked_at'    => time(),
		);
		return self::store( $decision );
	}

	/**
	 * Cheap, frequent kill-switch poll. If the SaaS says stop, we wipe the
	 * cached positive decision immediately.
	 */
	public static function check_kill_switch(): void {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return;
		}
		$res = $client->get( '/plugin/killswitch' );
		if ( ! $res->ok() ) {
			return;
		}
		$p = $res->payload();
		if ( ! empty( $p['kill'] ) ) {
			self::store( self::inactive_decision( (string) ( $p['reason'] ?? __( 'License inactive.', 'ai-revenue-recovery-engine' ) ) ) );
		}
	}

	private static function inactive_decision( string $reason ): array {
		return array(
			'active'        => false,
			'status'        => 'inactive',
			'reason'        => $reason,
			'entitlements'  => array(),
			'inGracePeriod' => false,
			'ttl'           => 120,
			'checked_at'    => time(),
		);
	}

	private static function store( array $decision ): array {
		update_option( self::CACHE_OPTION, $decision, false );
		self::$decision = $decision;
		return $decision;
	}

	/**
	 * Activate this site's domain against the license.
	 */
	public static function activate(): ARRE_Api_Response {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return new ARRE_Api_Response( 0, array(), __( 'Missing connection settings.', 'ai-revenue-recovery-engine' ) );
		}
		$res = $client->post( '/plugin/license/activate', array( 'domain' => self::domain() ) );
		if ( $res->ok() ) {
			self::refresh();
		}
		return $res;
	}

	public static function deactivate(): ARRE_Api_Response {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return new ARRE_Api_Response( 0, array(), __( 'Missing connection settings.', 'ai-revenue-recovery-engine' ) );
		}
		$res = $client->post( '/plugin/license/deactivate', array( 'domain' => self::domain() ) );
		self::store( self::inactive_decision( __( 'License deactivated on this site.', 'ai-revenue-recovery-engine' ) ) );
		return $res;
	}

	public static function domain(): string {
		$host = wp_parse_url( home_url(), PHP_URL_HOST );
		return is_string( $host ) ? $host : '';
	}
}
