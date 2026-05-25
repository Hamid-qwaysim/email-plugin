<?php
/**
 * Connection wizard view.
 *
 * @package ARRE
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;

$connected = ARRE_Settings::is_connected();
$active    = ARRE_License::is_active();
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'AI Revenue Recovery Engine', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<div class="arre-card">
		<h2><?php esc_html_e( 'Connection status', 'ai-revenue-recovery-engine' ); ?></h2>
		<p>
			<?php if ( $connected && $active ) : ?>
				<span class="arre-badge arre-badge--ok"><?php esc_html_e( 'Connected & active', 'ai-revenue-recovery-engine' ); ?></span>
			<?php elseif ( $connected ) : ?>
				<span class="arre-badge arre-badge--warn"><?php esc_html_e( 'Connected — license inactive', 'ai-revenue-recovery-engine' ); ?></span>
				<em><?php echo esc_html( ARRE_License::reason() ); ?></em>
			<?php else : ?>
				<span class="arre-badge arre-badge--off"><?php esc_html_e( 'Not connected', 'ai-revenue-recovery-engine' ); ?></span>
			<?php endif; ?>
		</p>
		<?php if ( $connected ) : ?>
			<ul class="arre-status-list">
				<li><?php esc_html_e( 'WooCommerce detected:', 'ai-revenue-recovery-engine' ); ?> <strong><?php echo class_exists( 'WooCommerce' ) ? 'Yes' : 'No'; ?></strong></li>
				<li><?php esc_html_e( 'HPOS enabled:', 'ai-revenue-recovery-engine' ); ?> <strong><?php echo ARRE_Diagnostics::hpos_enabled() ? 'Yes' : 'No'; ?></strong></li>
				<li><?php esc_html_e( 'Plan status:', 'ai-revenue-recovery-engine' ); ?> <strong><?php echo esc_html( ARRE_License::status_label() ); ?></strong></li>
			</ul>
		<?php endif; ?>
	</div>

	<div class="arre-card">
		<h2><?php esc_html_e( 'Connect your store', 'ai-revenue-recovery-engine' ); ?></h2>
		<p class="description">
			<?php esc_html_e( 'Paste the Store ID, license key, and one-time signing secret from your AI Revenue Recovery dashboard (Settings → Store connection).', 'ai-revenue-recovery-engine' ); ?>
		</p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
			<?php wp_nonce_field( 'arre_connect' ); ?>
			<input type="hidden" name="arre_action" value="connect" />
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="arre_store_id"><?php esc_html_e( 'Store ID', 'ai-revenue-recovery-engine' ); ?></label></th>
					<td><input name="arre_store_id" id="arre_store_id" type="text" class="regular-text" value="<?php echo esc_attr( (string) ARRE_Settings::get( 'store_id' ) ); ?>" autocomplete="off" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="arre_license_key"><?php esc_html_e( 'License key', 'ai-revenue-recovery-engine' ); ?></label></th>
					<td><input name="arre_license_key" id="arre_license_key" type="text" class="regular-text" value="<?php echo esc_attr( (string) ARRE_Settings::get( 'license_key' ) ); ?>" placeholder="ARRE-XXXX-XXXX-XXXX-XXXX" autocomplete="off" /></td>
				</tr>
				<tr>
					<th scope="row"><label for="arre_signing_secret"><?php esc_html_e( 'Signing secret', 'ai-revenue-recovery-engine' ); ?></label></th>
					<td>
						<input name="arre_signing_secret" id="arre_signing_secret" type="password" class="regular-text" value="" autocomplete="off" />
						<p class="description"><?php esc_html_e( 'Shown only once in the dashboard. Stored securely and never displayed again.', 'ai-revenue-recovery-engine' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Connect store', 'ai-revenue-recovery-engine' ) ); ?>
		</form>
	</div>
</div>
