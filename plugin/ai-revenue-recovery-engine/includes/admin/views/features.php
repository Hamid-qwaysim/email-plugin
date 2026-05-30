<?php
/**
 * Local feature toggles view.
 *
 * @package ARRE
 * @var array $features FeatureId => label map.
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;

$features = isset( $features ) && is_array( $features ) ? $features : array();
$active   = ARRE_License::is_active();
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'Feature controls', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<?php if ( ! $active ) : ?>
		<div class="notice notice-warning inline"><p><?php esc_html_e( 'Your license is inactive — premium features are paused regardless of these toggles.', 'ai-revenue-recovery-engine' ); ?></p></div>
	<?php endif; ?>

	<div class="arre-card">
		<p class="description"><?php esc_html_e( 'Turn features on or off locally. A feature only runs when your plan includes it AND it is enabled here.', 'ai-revenue-recovery-engine' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin.php' ) ); ?>">
			<?php wp_nonce_field( 'arre_features' ); ?>
			<input type="hidden" name="arre_action" value="save_features" />
			<table class="form-table" role="presentation">
				<?php foreach ( $features as $id => $label ) : ?>
					<?php $on = ARRE_Settings::is_toggled_on( (string) $id ); ?>
					<tr>
						<th scope="row"><?php echo esc_html( (string) $label ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="arre_toggle[<?php echo esc_attr( (string) $id ); ?>]" value="1" <?php checked( $on ); ?> />
								<?php esc_html_e( 'Enabled', 'ai-revenue-recovery-engine' ); ?>
							</label>
						</td>
					</tr>
				<?php endforeach; ?>
			</table>
			<?php submit_button( __( 'Save feature settings', 'ai-revenue-recovery-engine' ) ); ?>
		</form>
	</div>
</div>
