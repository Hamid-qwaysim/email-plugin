<?php
/**
 * Diagnostics view.
 *
 * @package ARRE
 * @var array $snapshot Diagnostics snapshot.
 */

declare( strict_types=1 );
defined( 'ABSPATH' ) || exit;

$snapshot = isset( $snapshot ) && is_array( $snapshot ) ? $snapshot : array();
?>
<div class="wrap arre-wrap">
	<h1><?php esc_html_e( 'Diagnostics', 'ai-revenue-recovery-engine' ); ?></h1>
	<?php ARRE_Admin::notice(); ?>

	<div class="arre-card">
		<table class="widefat striped">
			<tbody>
				<?php foreach ( $snapshot as $key => $value ) : ?>
					<tr>
						<th><?php echo esc_html( (string) $key ); ?></th>
						<td>
							<?php
							if ( is_bool( $value ) ) {
								echo $value ? esc_html__( 'Yes', 'ai-revenue-recovery-engine' ) : esc_html__( 'No', 'ai-revenue-recovery-engine' );
							} else {
								echo esc_html( (string) $value );
							}
							?>
						</td>
					</tr>
				<?php endforeach; ?>
			</tbody>
		</table>
		<p class="description"><?php esc_html_e( 'This bundle (no secrets) is what the SaaS uses to show your store health.', 'ai-revenue-recovery-engine' ); ?></p>
	</div>
</div>
