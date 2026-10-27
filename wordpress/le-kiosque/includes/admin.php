<?php
/**
 * Un seul écran : Outils du Kiosque → déposer kiosque-config.json → « Configurer ».
 */

defined( 'ABSPATH' ) || exit;

register_activation_hook(
	LE_KIOSQUE_DIR . '/le-kiosque.php',
	function () {
		set_transient( 'le_kiosque_redirection', 1, 60 );
	}
);

/* Après l'activation, on arrive directement sur l'écran du Kiosque (un clic de moins). */
add_action(
	'admin_init',
	function () {
		if ( get_transient( 'le_kiosque_redirection' ) && ! isset( $_GET['activate-multi'] ) && current_user_can( 'manage_options' ) ) {
			delete_transient( 'le_kiosque_redirection' );
			wp_safe_redirect( admin_url( 'admin.php?page=le-kiosque' ) );
			exit;
		}
	}
);

add_action(
	'admin_menu',
	function () {
		add_menu_page( 'Le Kiosque', 'Le Kiosque', 'manage_options', 'le-kiosque', 'le_kiosque_ecran', 'dashicons-media-document', 3 );
	}
);

function le_kiosque_ecran() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$messages = array();
	$erreur   = '';
	if ( 'POST' === ( $_SERVER['REQUEST_METHOD'] ?? '' ) && check_admin_referer( 'le_kiosque' ) ) {
		if ( isset( $_POST['annuler'] ) ) {
			$messages = Le_Kiosque_Importeur::annuler();
		} elseif ( ! empty( $_FILES['kiosque_config']['tmp_name'] ) ) {
			$d = Le_Kiosque_Importeur::lire( file_get_contents( $_FILES['kiosque_config']['tmp_name'] ) ); // phpcs:ignore
			if ( is_wp_error( $d ) ) {
				$erreur = $d->get_error_message();
			} else {
				$messages = Le_Kiosque_Importeur::appliquer( $d );
			}
		} else {
			$erreur = 'Choisissez d’abord le fichier kiosque-config.json.';
		}
	}
	$deja = (bool) get_option( Le_Kiosque_Importeur::ETAT );
	?>
	<div class="wrap" style="max-width:720px">
		<h1>Le Kiosque</h1>
		<?php if ( $erreur ) : ?>
			<div class="notice notice-error"><p><?php echo esc_html( $erreur ); ?></p></div>
		<?php endif; ?>
		<?php if ( $messages ) : ?>
			<div class="notice notice-success" id="kiosque-resultat"><p><strong><?php echo $deja ? 'Votre journal est configuré.' : 'C’est fait.'; ?></strong></p><ul style="list-style:disc;margin-left:20px">
			<?php foreach ( $messages as $m ) : ?>
				<li><?php echo esc_html( $m ); ?></li>
			<?php endforeach; ?>
			</ul>
			<?php if ( $deja ) : ?>
				<p><a class="button button-primary" href="<?php echo esc_url( home_url( '/' ) ); ?>">Voir le site</a> <a class="button" href="<?php echo esc_url( admin_url( 'user-new.php' ) ); ?>">Inviter l’équipe</a></p>
			<?php endif; ?>
			</div>
		<?php endif; ?>
		<p>Déposez le fichier <code>kiosque-config.json</code> téléchargé à la dernière étape du <a href="https://azdak919.github.io/le-kiosque/configurer/" target="_blank" rel="noopener">configurateur du Kiosque</a>, puis cliquez sur « Configurer ». Vous pouvez recommencer sans risque : rien n’est créé en double.</p>
		<form method="post" enctype="multipart/form-data">
			<?php wp_nonce_field( 'le_kiosque' ); ?>
			<p><input type="file" name="kiosque_config" id="kiosque_config" accept=".json,application/json"></p>
			<p><button type="submit" class="button button-primary button-hero" id="kiosque-configurer">Configurer</button></p>
		</form>
		<h2>Ce que fait « Configurer »</h2>
		<ul style="list-style:disc;margin-left:20px">
			<li>Active le thème Le Kiosque à vos couleurs, avec votre logo.</li>
			<li>Crée vos rubriques, le menu, et les pages Équipe, À propos, Politique de correction et Déontologie.</li>
			<li>Ajoute trois rôles : <strong>Journaliste</strong> (écrit et soumet), <strong>Chef de pupitre</strong> (relit et corrige, ne publie pas), <strong>Rédacteur en chef</strong> (publie).</li>
			<li>Ajoute au texte : chapeau, crédit photo et signatures multiples.</li>
			<li>Règle les liens permanents, le flux RSS (lisible par l’annuaire LE-RADAR), le fuseau horaire et ferme les inscriptions et commentaires anonymes.</li>
		</ul>
		<?php if ( $deja ) : ?>
			<form method="post" onsubmit="return confirm('Revenir à l’état d’avant le Kiosque ? Les pages créées iront à la corbeille.');">
				<?php wp_nonce_field( 'le_kiosque' ); ?>
				<p><button type="submit" name="annuler" value="1" class="button" id="kiosque-annuler">Annuler la configuration</button></p>
			</form>
		<?php endif; ?>
	</div>
	<?php
}
