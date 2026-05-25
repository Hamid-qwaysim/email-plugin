<?php
/**
 * License management view.
 *
 * @package ARRE
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;

$decision = ARRE_License::decision();
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'License', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<div class="arre-card">
		<table class="widefat striped">
			<tbody>
				<tr><th><?php esc_html_e( 'License key', 'ai-revenue-recovery-engine' ); ?></th><td><code><?php echo esc_html( (string) ARRE_Settings::get( 'license_key' ) ); ?></code></td></tr>
				<tr><th><?php esc_html_e( 'Status', 'ai-revenue-recovery-engine' ); ?></th><td><?php echo esc_html( (string) ( $decision['status'] ?? 'unknown' ) ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Active', 'ai-revenue-recovery-engine' ); ?></th><td><?php echo ARRE_License::is_active() ? esc_html__( 'Yes', 'ai-revenue-recovery-engine' ) : esc_html__( 'No', 'ai-revenue-recovery-engine' ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Reason', 'ai-revenue-recovery-engine' ); ?></th><td><?php echo esc_html( (string) ( $decision['reason'] ?? '' ) ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Bound domain', 'ai-revenue-recovery-engine' ); ?></th><td><?php echo esc_html( ARRE_License::domain() ); ?></td></tr>
				<tr><th><?php esc_html_e( 'Last checked', 'ai-revenue-recovery-engine' ); ?></th><td><?php echo esc_html( $decision['checked_at'] ? human_time_diff( (int) $decision['checked_at'] ) . ' ' . __( 'ago', 'ai-revenue-recovery-engine' ) : '—' ); ?></td></tr>
			</tbody>
		</table>
	</div>

	<div class="arre-card">
		<h2><?php esc_html_e( 'Entitled features', 'ai-revenue-recovery-engine' ); ?></h2>
		<?php $ent = isset( $decision['entitlements'] ) && is_array( $decision['entitlements'] ) ? $decision['entitlements'] : array(); ?>
		<?php if ( empty( $ent ) ) : ?>
			<p class="description"><?php esc_html_e( 'No active entitlements. Connect and activate to see your plan features.', 'ai-revenue-recovery-engine' ); ?></p>
		<?php else : ?>
			<ul class="arre-pill-list">
				<?php foreach ( $ent as $f ) : ?>
					<li class="arre-pill"><?php echo esc_html( (string) $f ); ?></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
	</div>

	<div class="arre-card arre-actions">
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" style="display:inline-block">
			<?php wp_nonce_field( 'arre_recheck' ); ?>
			<input type="hidden" name="arre_action" value="recheck" />
			<?php submit_button( __( 'Force re-check', 'ai-revenue-recovery-engine' ), 'secondary', 'submit', false ); ?>
		</form>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>" style="display:inline-block" onsubmit="return confirm('<?php echo esc_js( __( 'Deactivate this site from the license?', 'ai-revenue-recovery-engine' ) ); ?>');">
			<?php wp_nonce_field( 'arre_deactivate' ); ?>
			<input type="hidden" name="arre_action" value="deactivate" />
			<?php submit_button( __( 'Deactivate this site', 'ai-revenue-recovery-engine' ), 'delete', 'submit', false ); ?>
		</form>
	</div>
</div>
