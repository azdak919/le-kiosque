<?php
/**
 * Plugin Name:       Le Kiosque
 * Plugin URI:        https://github.com/azdak919/le-kiosque
 * Description:       Configure un WordPress neuf pour un journal étudiant à partir du fichier kiosque-config.json produit par le configurateur du Kiosque : thème, couleurs, sections, menu, pages, rôles de rédaction, chapeau, crédit photo et signatures multiples. Réversible.
 * Version:           0.1.0
 * Requires at least: 6.4
 * Requires PHP:      7.4
 * Author:            Azdak
 * License:           MIT
 * Text Domain:       le-kiosque
 */

defined( 'ABSPATH' ) || exit;

define( 'LE_KIOSQUE_VERSION', '0.1.0' );
define( 'LE_KIOSQUE_DIR', __DIR__ );

require_once __DIR__ . '/includes/champs.php';
require_once __DIR__ . '/includes/importeur.php';
require_once __DIR__ . '/includes/admin.php';

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require_once __DIR__ . '/includes/cli.php';
}
