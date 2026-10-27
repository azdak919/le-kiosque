<?php
/**
 * wp kiosque importer <fichier>   Applique un kiosque-config.json.
 * wp kiosque annuler              Revient à l'état d'avant.
 */

defined( 'ABSPATH' ) || exit;

WP_CLI::add_command(
	'kiosque importer',
	function ( $args ) {
		$d = Le_Kiosque_Importeur::lire( file_get_contents( $args[0] ) );
		if ( is_wp_error( $d ) ) {
			WP_CLI::error( $d->get_error_message() );
		}
		foreach ( Le_Kiosque_Importeur::appliquer( $d ) as $l ) {
			WP_CLI::log( $l );
		}
		WP_CLI::success( 'Journal configuré.' );
	}
);
WP_CLI::add_command(
	'kiosque annuler',
	function () {
		foreach ( Le_Kiosque_Importeur::annuler() as $l ) {
			WP_CLI::log( $l );
		}
		WP_CLI::success( 'Annulé.' );
	}
);
