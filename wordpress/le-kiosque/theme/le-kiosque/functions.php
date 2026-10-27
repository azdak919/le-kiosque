<?php
/** Couleurs du journal (option posée par l'extension) injectées dans theme.json. */
add_filter(
	'wp_theme_json_data_theme',
	function ( $theme_json ) {
		$c = get_option( 'le_kiosque_config', array() );
		if ( empty( $c['couleur'] ) ) {
			return $theme_json;
		}
		return $theme_json->update_with(
			array(
				'version'  => 2,
				'settings' => array(
					'color' => array(
						'palette' => array(
							array( 'slug' => 'accent', 'name' => 'Couleur du journal', 'color' => $c['couleur'] ),
							array( 'slug' => 'accent-dark', 'name' => 'Couleur du journal (sombre)', 'color' => $c['couleurSombre'] ?: $c['couleur'] ),
							array( 'slug' => 'base', 'name' => 'Fond', 'color' => '#ffffff' ),
							array( 'slug' => 'contrast', 'name' => 'Texte', 'color' => '#16181d' ),
						),
					),
				),
			)
		);
	}
);
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'le-kiosque', get_stylesheet_uri(), array(), '0.1.0' );
} );
/* Bandeau de l'établissement au-dessus du mât. */
add_filter( 'render_block_core/template-part', function ( $html, $block ) {
	if ( ( $block['attrs']['slug'] ?? '' ) !== 'header' ) {
		return $html;
	}
	$c = get_option( 'le_kiosque_config', array() );
	return empty( $c['etablissement'] ) ? $html : '<p class="kiosque-etablissement">' . esc_html( $c['etablissement'] ) . '</p>' . $html;
}, 10, 2 );
