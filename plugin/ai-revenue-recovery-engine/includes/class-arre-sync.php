<?php
/**
 * WooCommerce data sync to the SaaS, batched via Action Scheduler so it never
 * blocks admin or storefront requests. Supports incremental (recent changes)
 * and full sync, plus diagnostics reporting.
 *
 * @package ARRE
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

final class ARRE_Sync {

	private const BATCH = 50;

	/**
	 * Incremental sync: most-recently-modified products + recent orders.
	 */
	public static function run_incremental(): void {
		if ( ! ARRE_Settings::is_connected() || ! ARRE_License::is_active() ) {
			return;
		}
		self::sync_products( 1 );
		self::report_diagnostics();
		ARRE_Coupons::cleanup_expired();
	}

	/**
	 * Full sync kicked off from the admin "Manual full sync" button. Schedules
	 * per-page jobs so large catalogs don't time out.
	 */
	public static function full_sync(): void {
		if ( ! ARRE_License::feature_enabled( 'product_recommendations' ) && ! ARRE_License::is_active() ) {
			return;
		}
		$total = (int) wp_count_posts( 'product' )->publish;
		$pages = (int) ceil( $total / self::BATCH );
		for ( $page = 1; $page <= max( 1, $pages ); $page++ ) {
			if ( function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action( 'arre_sync_products_page', array( $page ), 'arre' );
			} else {
				self::sync_products( $page );
			}
		}
	}

	/**
	 * Sync a single page of products.
	 *
	 * @param int $page 1-based page.
	 */
	public static function sync_products( int $page ): void {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return;
		}

		$query = new WC_Product_Query(
			array(
				'limit'    => self::BATCH,
				'page'     => max( 1, $page ),
				'orderby'  => 'modified',
				'order'    => 'DESC',
				'status'   => 'publish',
				'return'   => 'objects',
			)
		);
		$products = $query->get_products();
		if ( empty( $products ) ) {
			return;
		}

		$payload = array();
		foreach ( $products as $product ) {
			/** @var WC_Product $product */
			$payload[] = array(
				'wooId'       => $product->get_id(),
				'name'        => $product->get_name(),
				'sku'         => $product->get_sku(),
				'priceCents'  => (int) round( (float) $product->get_price() * 100 ),
				'stockStatus' => $product->get_stock_status(),
				'stockQty'    => $product->get_stock_quantity(),
				'imageUrl'    => wp_get_attachment_url( $product->get_image_id() ) ?: null,
				'categories'  => wp_get_post_terms( $product->get_id(), 'product_cat', array( 'fields' => 'names' ) ),
			);
		}

		$client->post(
			'/plugin/sync/products',
			array(
				'storeId'  => (string) ARRE_Settings::get( 'store_id' ),
				'products' => $payload,
				'page'     => $page,
			)
		);

		ARRE_Settings::update( array() ); // touch cache; last_sync handled server-side
	}

	/**
	 * Send a diagnostics snapshot so the SaaS can show store health.
	 */
	public static function report_diagnostics(): void {
		$client = ARRE_Api_Client::from_settings();
		if ( null === $client ) {
			return;
		}
		$client->post( '/plugin/diagnostics', ARRE_Diagnostics::snapshot() );
	}
}

// Per-page async hook for full sync.
add_action(
	'arre_sync_products_page',
	static function ( $page ): void {
		ARRE_Sync::sync_products( (int) $page );
	}
);
