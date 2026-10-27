<?php
/**
 * Champs éditoriaux : chapeau, crédit photo, signatures multiples.
 * Exposés dans l'API REST (lus par la synchro du Kiosque, jalon 5).
 */

defined( 'ABSPATH' ) || exit;

const LE_KIOSQUE_CHAMPS = array(
	'kiosque_chapeau'      => 'Chapeau (texte d’introduction sous le titre)',
	'kiosque_credit_photo' => 'Crédit de la photo principale',
	'kiosque_signatures'   => 'Signatures (une par ligne, si plusieurs auteurs)',
);

add_action(
	'init',
	function () {
		foreach ( array_keys( LE_KIOSQUE_CHAMPS ) as $cle ) {
			register_post_meta(
				'post',
				$cle,
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => true,
					'sanitize_callback' => 'sanitize_textarea_field',
					'auth_callback'     => function ( $permis, $cle, $post_id ) {
						return current_user_can( 'edit_post', $post_id );
					},
				)
			);
		}
		register_post_meta(
			'attachment',
			'kiosque_credit_photo',
			array( 'type' => 'string', 'single' => true, 'show_in_rest' => true, 'sanitize_callback' => 'sanitize_text_field' )
		);
	}
);

/* Boîte « Le Kiosque » dans l'éditeur (fonctionne aussi dans l'éditeur de blocs). */
add_action(
	'add_meta_boxes_post',
	function () {
		// Boîte classique seulement hors éditeur de blocs (le panneau JS la remplace).
		add_meta_box( 'le-kiosque-champs', 'Le Kiosque', 'le_kiosque_boite', 'post', 'normal', 'high', array( '__back_compat_meta_box' => true ) );
	}
);

function le_kiosque_boite( $post ) {
	wp_nonce_field( 'le_kiosque_champs', 'le_kiosque_champs_nonce' );
	foreach ( LE_KIOSQUE_CHAMPS as $cle => $etiquette ) {
		$valeur = get_post_meta( $post->ID, $cle, true );
		printf( '<p><label for="%1$s"><strong>%2$s</strong></label><br>', esc_attr( $cle ), esc_html( $etiquette ) );
		if ( 'kiosque_credit_photo' === $cle ) {
			printf( '<input type="text" class="widefat" id="%1$s" name="%1$s" value="%2$s"></p>', esc_attr( $cle ), esc_attr( $valeur ) );
		} else {
			printf( '<textarea class="widefat" rows="3" id="%1$s" name="%1$s">%2$s</textarea></p>', esc_attr( $cle ), esc_textarea( $valeur ) );
		}
	}
}

add_action(
	'save_post_post',
	function ( $post_id ) {
		if ( ! isset( $_POST['le_kiosque_champs_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['le_kiosque_champs_nonce'] ), 'le_kiosque_champs' ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		foreach ( array_keys( LE_KIOSQUE_CHAMPS ) as $cle ) {
			if ( isset( $_POST[ $cle ] ) ) {
				update_post_meta( $post_id, $cle, sanitize_textarea_field( wp_unslash( $_POST[ $cle ] ) ) );
			}
		}
	}
);

add_action(
	'enqueue_block_editor_assets',
	function () {
		wp_enqueue_script( 'le-kiosque-editeur', plugins_url( 'assets/editeur.js', LE_KIOSQUE_DIR . '/le-kiosque.php' ), array( 'wp-plugins', 'wp-editor', 'wp-components', 'wp-data', 'wp-element' ), LE_KIOSQUE_VERSION, true );
	}
);

/* Affichage : chapeau avant le texte, signatures et crédit après. */
add_filter(
	'the_content',
	function ( $contenu ) {
		if ( ! is_singular( 'post' ) || ! in_the_loop() ) {
			return $contenu;
		}
		$id      = get_the_ID();
		$chapeau = get_post_meta( $id, 'kiosque_chapeau', true );
		$credit  = get_post_meta( $id, 'kiosque_credit_photo', true );
		$sign    = array_filter( array_map( 'trim', explode( "\n", (string) get_post_meta( $id, 'kiosque_signatures', true ) ) ) );
		$avant   = $chapeau ? '<p class="kiosque-chapeau">' . esc_html( $chapeau ) . '</p>' : '';
		$apres   = '';
		if ( $sign ) {
			$apres .= '<p class="kiosque-signatures">Par ' . esc_html( implode( ', ', $sign ) ) . '</p>';
		}
		if ( $credit ) {
			$apres .= '<p class="kiosque-credit">Photo : ' . esc_html( $credit ) . '</p>';
		}
		return $avant . $contenu . $apres;
	},
	5
);

/* Flux RSS : contenu complet, chapeau en résumé, crédit et signatures (annuaire LE-RADAR). */
add_filter(
	'the_excerpt_rss',
	function ( $resume ) {
		$chapeau = get_post_meta( get_the_ID(), 'kiosque_chapeau', true );
		return $chapeau ? esc_html( $chapeau ) : $resume;
	}
);
add_action(
	'rss2_item',
	function () {
		$sign = array_filter( array_map( 'trim', explode( "\n", (string) get_post_meta( get_the_ID(), 'kiosque_signatures', true ) ) ) );
		foreach ( $sign as $s ) {
			echo "\t\t<dc:creator><![CDATA[" . esc_html( $s ) . "]]></dc:creator>\n";
		}
		if ( has_post_thumbnail() ) {
			$url = get_the_post_thumbnail_url( null, 'large' );
			echo "\t\t<enclosure url=\"" . esc_url( $url ) . "\" type=\"" . esc_attr( get_post_mime_type( get_post_thumbnail_id() ) ) . "\" length=\"0\" />\n";
		}
	}
);
