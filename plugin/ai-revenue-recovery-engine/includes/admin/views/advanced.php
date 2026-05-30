<?php
/**
 * Advanced settings view.
 *
 * @package ARRE
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'Advanced', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<div class="arre-card">
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
			<?php wp_nonce_field( 'arre_advanced' ); ?>
			<input type="hidden" name="arre_action" value="save_advanced" />
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="arre_api_base"><?php esc_html_e( 'API endpoint', 'ai-revenue-recovery-engine' ); ?></label></th>
					<td><input name="arre_api_base" id="arre_api_base" type="url" class="regular-text code" value="<?php echo esc_attr( ARRE_Settings::get_api_base() ); ?>" /></td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Consent mode', 'ai-revenue-recovery-engine' ); ?></th>
					<td>
						<select name="arre_consent_mode">
							<option value="implied" <?php selected( ARRE_Settings::get( 'consent_mode' ), 'implied' ); ?>><?php esc_html_e( 'Implied', 'ai-revenue-recovery-engine' ); ?></option>
							<option value="explicit" <?php selected( ARRE_Settings::get( 'consent_mode' ), 'explicit' ); ?>><?php esc_html_e( 'Explicit (require opt-in)', 'ai-revenue-recovery-engine' ); ?></option>
						</select>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Exclude admins from tracking', 'ai-revenue-recovery-engine' ); ?></th>
					<td><label><input type="checkbox" name="arre_exclude_admins" value="1" <?php checked( (bool) ARRE_Settings::get( 'exclude_admins' ) ); ?> /> <?php esc_html_e( 'Enabled', 'ai-revenue-recovery-engine' ); ?></label></td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Debug logging', 'ai-revenue-recovery-engine' ); ?></th>
					<td><label><input type="checkbox" name="arre_debug" value="1" <?php checked( (bool) ARRE_Settings::get( 'debug' ) ); ?> /> <?php esc_html_e( 'Enabled', 'ai-revenue-recovery-engine' ); ?></label></td>
				</tr>
			</table>
			<?php submit_button( __( 'Save advanced settings', 'ai-revenue-recovery-engine' ) ); ?>
		</form>
	</div>

	<div class="arre-card arre-danger">
		<h2><?php esc_html_e( 'Danger zone', 'ai-revenue-recovery-engine' ); ?></h2>
		<p class="description"><?php esc_html_e( 'Reset removes all local plugin settings, the signing secret, and cached license state from this site.', 'ai-revenue-recovery-engine' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" onsubmit="return confirm('<?php echo esc_js( __( 'This will erase all local plugin data. Continue?', 'ai-revenue-recovery-engine' ) ); ?>');">
			<?php wp_nonce_field( 'arre_reset' ); ?>
			<input type="hidden" name="arre_action" value="reset" />
			<?php submit_button( __( 'Reset plugin data', 'ai-revenue-recovery-engine' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
</div>
