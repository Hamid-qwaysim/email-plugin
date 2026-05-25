<?php
/**
 * Signed HTTP client for talking to the SaaS API.
 *
 * Builds the exact canonical string defined in packages/shared/src/signing.ts
 * and signs it with the per-store signing secret using HMAC-SHA256. Never logs
 * secrets. All inbound responses are treated as untrusted and decoded safely.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Api_Client {

	private const SIG_VERSION = 'v1';

	public function __construct(
		private string $api_base,
		private string $store_id,
		private string $license_key,
		private string $signing_secret
	) {}

	/**
	 * Build a client from stored settings, or null if not yet connected.
	 */
	public static function from_settings(): ?self {
		$store_id = ARRE_Settings::get( 'store_id' );
		$license  = ARRE_Settings::get( 'license_key' );
		$secret   = ARRE_Settings::get_secret();
		$base     = ARRE_Settings::get_api_base();

		if ( empty( $store_id ) || empty( $license ) || empty( $secret ) ) {
			return null;
		}
		return new self( $base, (string) $store_id, (string) $license, (string) $secret );
	}

	public function get( string $path, array $query = array() ): ARRE_Api_Response {
		return $this->request( 'GET', $path, null, $query );
	}

	public function post( string $path, array $body ): ARRE_Api_Response {
		return $this->request( 'POST', $path, $body );
	}

	/**
	 * Perform a signed request.
	 *
	 * @param string     $method HTTP method.
	 * @param string     $path   Path beginning with '/', relative to api_base host.
	 * @param array|null $body   JSON body for write requests.
	 * @param array      $query  Query parameters.
	 */
	private function request( string $method, string $path, ?array $body, array $query = array() ): ARRE_Api_Response {
		$method   = strtoupper( $method );
		$base     = rtrim( $this->api_base, '/' );
		$full_path = $this->path_with_prefix( $base, $path );

		$json_body = null === $body ? '' : (string) wp_json_encode( $body );
		$body_hash = hash( 'sha256', $json_body );

		$timestamp = time();
		$nonce     = $this->random_nonce();

		// Canonical string MUST match buildCanonicalString() in shared/signing.ts.
		$canonical = implode(
			"\n",
			array(
				self::SIG_VERSION,
				$method,
				$full_path,
				$this->store_id,
				$this->license_key,
				(string) $timestamp,
				$nonce,
				$body_hash,
			)
		);

		$signature = hash_hmac( 'sha256', $canonical, $this->signing_secret );

		$url = $base . $path;
		if ( ! empty( $query ) ) {
			$url = add_query_arg( array_map( 'rawurlencode', $query ), $url );
		}

		$args = array(
			'method'  => $method,
			'timeout' => 15,
			'headers' => array(
				'Content-Type'        => 'application/json',
				'Accept'              => 'application/json',
				'X-ARRE-Store'        => $this->store_id,
				'X-ARRE-License'      => $this->license_key,
				'X-ARRE-Timestamp'    => (string) $timestamp,
				'X-ARRE-Nonce'        => $nonce,
				'X-ARRE-Signature'    => $signature,
				'X-ARRE-Sig-Version'  => self::SIG_VERSION,
				'User-Agent'          => 'ARRE-Plugin/' . ARRE_VERSION,
			),
		);
		if ( 'GET' !== $method ) {
			$args['body'] = $json_body;
		}

		$response = wp_remote_request( $url, $args );

		if ( is_wp_error( $response ) ) {
			return new ARRE_Api_Response( 0, array(), $response->get_error_message() );
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = (string) wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) ) {
			$data = array();
		}

		return new ARRE_Api_Response( $code, $data, null );
	}

	/**
	 * The Worker verifies the signature over the URL pathname (no host, no query).
	 */
	private function path_with_prefix( string $base, string $path ): string {
		$parts = wp_parse_url( $base );
		$base_path = isset( $parts['path'] ) ? rtrim( (string) $parts['path'], '/' ) : '';
		return $base_path . $path;
	}

	private function random_nonce(): string {
		try {
			return bin2hex( random_bytes( 16 ) );
		} catch ( \Exception $e ) {
			return wp_generate_uuid4();
		}
	}
}

/**
 * Lightweight response value object.
 */
final class ARRE_Api_Response {

	public function __construct(
		public readonly int $status,
		public readonly array $data,
		public readonly ?string $error
	) {}

	public function ok(): bool {
		return $this->status >= 200 && $this->status < 300 && empty( $this->error );
	}

	/**
	 * The API wraps successful payloads as { ok: true, data: {...} }.
	 */
	public function payload(): array {
		if ( isset( $this->data['data'] ) && is_array( $this->data['data'] ) ) {
			return $this->data['data'];
		}
		return $this->data;
	}

	public function error_message(): string {
		if ( $this->error ) {
			return $this->error;
		}
		if ( isset( $this->data['error']['message'] ) ) {
			return (string) $this->data['error']['message'];
		}
		return __( 'Unknown error.', 'ai-revenue-recovery-engine' );
	}
}
