<?php
/**
 * WooCommerce sync view.
 *
 * @package ARRE
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'WooCommerce Sync', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<div class="arre-card">
		<p class="description"><?php esc_html_e( 'Sync products, customers, orders and coupons to the SaaS. Incremental sync runs automatically in the background via Action Scheduler.', 'ai-revenue-recovery-engine' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
			<?php wp_nonce_field( 'arre_sync' ); ?>
			<input type="hidden" name="arre_action" value="full_sync" />
			<?php submit_button( __( 'Run manual full sync', 'ai-revenue-recovery-engine' ), 'primary', 'submit', false ); ?>
		</form>
	</div>

	<div class="arre-card">
		<h2><?php esc_html_e( 'Scheduler', 'ai-revenue-recovery-engine' ); ?></h2>
		<p>
			<?php
			echo esc_html(
				function_exists( 'as_has_scheduled_action' )
					? __( 'Action Scheduler is available (recommended).', 'ai-revenue-recovery-engine' )
					: __( 'Falling back to WP-Cron.', 'ai-revenue-recovery-engine' )
			);
			?>
		</p>
	</div>
</div>
