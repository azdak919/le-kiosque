<?php
/**
 * Applique un kiosque-config.json à WordPress. Idempotent (relancer donne le
 * même résultat, sans doublons) et réversible (Le_Kiosque_Importeur::annuler).
 *
 * Tout ce qui est créé ou modifié est noté dans l'option « le_kiosque_etat » :
 * identifiants créés et valeurs d'origine des réglages, pour pouvoir revenir
 * exactement à l'état d'avant.
 */

defined( 'ABSPATH' ) || exit;

class Le_Kiosque_Importeur {

	const ETAT   = 'le_kiosque_etat';
	const CONFIG = 'le_kiosque_config';
	const THEME  = 'le-kiosque';

	/** Réglages de base sûrs pour un journal étudiant. */
	const REGLAGES = array(
		'permalink_structure'    => '/%year%/%monthnum%/%postname%/',
		'users_can_register'     => '0',
		'default_role'           => 'subscriber',
		'default_comment_status' => 'closed',
		'default_ping_status'    => 'closed',
		'comment_moderation'     => '1',
		'comment_registration'   => '1',
		'rss_use_excerpt'        => '0',
		'posts_per_rss'          => '20',
		'timezone_string'        => 'America/Toronto',
		'date_format'            => 'j F Y',
		'time_format'            => 'G \h i',
		'start_of_week'          => '0',
		'WPLANG'                 => 'fr_CA',
		'blog_public'            => '1',
	);

	/** Lit et vérifie un kiosque-config.json. @return array|WP_Error */
	public static function lire( $json ) {
		$d = json_decode( (string) $json, true );
		if ( ! is_array( $d ) || ( $d['format'] ?? '' ) !== 'kiosque-config' ) {
			return new WP_Error( 'kiosque_format', 'Ce fichier n’est pas un kiosque-config.json (exportez-le depuis le configurateur du Kiosque, étape « C’est prêt »).' );
		}
		if ( (int) ( $d['version'] ?? 0 ) > 1 ) {
			return new WP_Error( 'kiosque_version', 'Ce fichier vient d’une version plus récente du Kiosque. Mettez l’extension à jour.' );
		}
		if ( empty( $d['journal']['nom'] ) ) {
			return new WP_Error( 'kiosque_nom', 'Le nom du journal manque dans le fichier.' );
		}
		$couleur = $d['apparence']['couleur'] ?? '';
		if ( ! preg_match( '/^#[0-9a-f]{6}$/i', $couleur ) ) {
			$d['apparence']['couleur'] = '#6c2163';
		}
		return $d;
	}

	/** @return array Résumé lisible de ce qui a été fait. */
	public static function appliquer( array $d ) {
		$etat    = get_option( self::ETAT, array() );
		$etat   += array( 'avant' => array(), 'cree' => array( 'termes' => array(), 'pages' => array(), 'posts' => array() ), 'roles' => array() );
		$fait    = array();
		$j       = $d['journal'];
		$a       = $d['apparence'] ?? array();

		// Réglages : on garde la valeur d'origine la première fois seulement.
		$reglages = self::REGLAGES + array(
			'blogname'        => $j['nom'],
			'blogdescription' => ! empty( $j['signature'] ) ? $j['signature'] : 'Le journal étudiant — ' . ( $j['etablissement'] ?? '' ),
		);
		if ( ! empty( $j['fuseau'] ) ) {
			$reglages['timezone_string'] = $j['fuseau'];
		}
		foreach ( $reglages as $cle => $valeur ) {
			if ( ! array_key_exists( $cle, $etat['avant'] ) ) {
				$etat['avant'][ $cle ] = get_option( $cle, null );
			}
			update_option( $cle, $valeur );
		}
		$fait[] = 'Nom, signature, fuseau, liens permanents et réglages de sécurité de base.';

		// Thème du Kiosque (thème de blocs livré avec l'extension).
		if ( ! array_key_exists( 'theme', $etat['avant'] ) ) {
			$etat['avant']['theme'] = get_stylesheet();
		}
		self::installer_theme();
		switch_theme( self::THEME );
		update_option( self::CONFIG, array( 'couleur' => $a['couleur'], 'couleurSombre' => $a['couleurSombre'] ?? '', 'typographie' => $a['typographie'] ?? '', 'etablissement' => $j['etablissement'] ?? '', 'options' => $d['options'] ?? array() ) );
		$fait[] = 'Thème Le Kiosque activé, couleur ' . $a['couleur'] . '.';

		// Logo (data: URL exportée par le configurateur).
		if ( ! empty( $a['logo'] ) && preg_match( '#^data:image/(png|jpeg|webp|svg\+xml);base64,(.+)$#', $a['logo'], $m ) ) {
			$ext = array( 'png' => 'png', 'jpeg' => 'jpg', 'webp' => 'webp', 'svg+xml' => 'svg' )[ $m[1] ];
			if ( 'svg' !== $ext ) { // SVG refusé par défaut dans WordPress : on ne force pas.
				$bits = wp_upload_bits( 'logo-' . sanitize_title( $j['nom'] ) . '.' . $ext, null, base64_decode( $m[2] ) );
				if ( empty( $bits['error'] ) ) {
					$id = wp_insert_attachment( array( 'post_title' => $a['logoAlt'] ?? $j['nom'], 'post_mime_type' => 'image/' . $m[1], 'post_status' => 'inherit' ), $bits['file'] );
					if ( ! array_key_exists( 'site_logo', $etat['avant'] ) ) {
						$etat['avant']['site_logo'] = get_option( 'site_logo', null );
					}
					update_option( 'site_logo', $id );
					$etat['cree']['posts'][] = $id;
					$fait[] = 'Logo téléversé.';
				}
			}
		}

		// Rubriques = catégories.
		$liens = array();
		foreach ( $d['sections'] ?? array() as $s ) {
			$terme = get_term_by( 'slug', $s['slug'], 'category' );
			if ( ! $terme ) {
				$r = wp_insert_term( $s['nom'], 'category', array( 'slug' => $s['slug'], 'description' => $s['description'] ?? '' ) );
				if ( is_wp_error( $r ) ) {
					continue;
				}
				$etat['cree']['termes'][] = (int) $r['term_id'];
				$terme = get_term( $r['term_id'], 'category' );
			}
			$liens[] = array( 'label' => $terme->name, 'id' => (int) $terme->term_id );
		}
		$fait[] = count( $liens ) . ' rubrique(s).';

		// Pages de base.
		$pages = array();
		foreach ( $d['pages'] ?? array() as $p ) {
			$existante = get_page_by_path( $p['slug'] );
			if ( $existante ) {
				$pages[] = array( 'label' => $existante->post_title, 'id' => $existante->ID );
				continue;
			}
			$id = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'publish', 'post_title' => $p['titre'], 'post_name' => $p['slug'], 'post_content' => self::contenu_page( $p['slug'], $j ) ) );
			if ( $id && ! is_wp_error( $id ) ) {
				$etat['cree']['pages'][] = $id;
				$pages[] = array( 'label' => $p['titre'], 'id' => $id );
			}
		}
		$fait[] = count( $pages ) . ' page(s) : Équipe, À propos, Politique de correction, Déontologie.';

		// Menu (navigation du thème de blocs), recréé à chaque import.
		$blocs = '';
		foreach ( $liens as $l ) {
			$blocs .= sprintf( '<!-- wp:navigation-link {"label":"%s","type":"category","id":%d,"kind":"taxonomy","url":"%s"} /-->', esc_attr( $l['label'] ), $l['id'], esc_url( get_category_link( $l['id'] ) ) );
		}
		foreach ( $pages as $l ) {
			$blocs .= sprintf( '<!-- wp:navigation-link {"label":"%s","type":"page","id":%d,"kind":"post-type","url":"%s"} /-->', esc_attr( $l['label'] ), $l['id'], esc_url( get_permalink( $l['id'] ) ) );
		}
		$nav = get_page_by_path( 'menu-le-kiosque', OBJECT, 'wp_navigation' );
		$arr = array( 'post_type' => 'wp_navigation', 'post_status' => 'publish', 'post_title' => 'Menu Le Kiosque', 'post_name' => 'menu-le-kiosque', 'post_content' => $blocs );
		if ( $nav ) {
			$arr['ID'] = $nav->ID;
			wp_update_post( $arr );
		} else {
			$etat['cree']['posts'][] = wp_insert_post( $arr );
		}
		$fait[] = 'Menu principal.';

		// Rôles de rédaction.
		self::roles( $d['roles'] ?? array() );
		$etat['roles'] = wp_list_pluck( $d['roles'] ?? array(), 'base', 'slug' );
		$fait[] = 'Rôles : Journaliste (soumet), Chef de pupitre (relit, ne publie pas), Rédacteur en chef (publie).';

		update_option( self::ETAT, $etat, false );
		flush_rewrite_rules( false );
		return $fait;
	}

	/** Revient à l'état d'avant le premier import. */
	public static function annuler() {
		$etat = get_option( self::ETAT );
		if ( ! $etat ) {
			return array( 'Rien à annuler.' );
		}
		foreach ( $etat['roles'] ?? array() as $slug => $base ) {
			foreach ( get_users( array( 'role' => $slug ) ) as $u ) {
				$u->set_role( $base ); // Personne ne perd son accès.
			}
			remove_role( $slug );
		}
		foreach ( $etat['cree']['pages'] as $id ) {
			wp_trash_post( $id ); // Corbeille : récupérable.
		}
		foreach ( $etat['cree']['posts'] as $id ) {
			wp_delete_post( $id, true );
		}
		foreach ( $etat['cree']['termes'] as $id ) {
			wp_delete_term( $id, 'category' ); // Les articles retombent dans la catégorie par défaut.
		}
		$theme = $etat['avant']['theme'] ?? null;
		unset( $etat['avant']['theme'] );
		foreach ( $etat['avant'] as $cle => $valeur ) {
			null === $valeur ? delete_option( $cle ) : update_option( $cle, $valeur );
		}
		if ( $theme && wp_get_theme( $theme )->exists() ) {
			switch_theme( $theme );
		}
		delete_option( self::ETAT );
		delete_option( self::CONFIG );
		flush_rewrite_rules( false );
		return array( 'Configuration du Kiosque annulée : réglages, thème et rôles d’origine rétablis; pages créées dans la corbeille.' );
	}

	public static function roles( array $roles ) {
		$editeur     = get_role( 'editor' )->capabilities;
		$contributeur = get_role( 'contributor' )->capabilities;
		$caps = array(
			'kiosque_journaliste'    => $contributeur + array( 'upload_files' => true ),
			'kiosque_chef_pupitre'   => array_diff_key( $editeur, array_flip( array( 'publish_posts', 'publish_pages' ) ) ),
			'kiosque_redacteur_chef' => $editeur,
		);
		foreach ( $roles as $r ) {
			if ( ! isset( $caps[ $r['slug'] ] ) ) {
				continue;
			}
			remove_role( $r['slug'] ); // Recréé à l'identique : idempotent.
			add_role( $r['slug'], $r['nom'], $caps[ $r['slug'] ] );
		}
	}

	private static function installer_theme() {
		$cible = trailingslashit( get_theme_root() ) . self::THEME;
		require_once ABSPATH . 'wp-admin/includes/file.php';
		WP_Filesystem();
		wp_mkdir_p( $cible );
		copy_dir( LE_KIOSQUE_DIR . '/theme/' . self::THEME, $cible );
		wp_clean_themes_cache();
	}

	private static function contenu_page( $slug, $j ) {
		$nom = esc_html( $j['nom'] );
		$eta = esc_html( $j['etablissement'] ?? '' );
		$p   = function ( $t ) {
			return "<!-- wp:paragraph -->\n<p>$t</p>\n<!-- /wp:paragraph -->\n";
		};
		$h   = function ( $t ) {
			return "<!-- wp:heading -->\n<h2 class=\"wp-block-heading\">$t</h2>\n<!-- /wp:heading -->\n";
		};
		switch ( $slug ) {
			case 'equipe':
				return $p( "$nom est fait par des étudiantes et des étudiants de $eta." ) . $h( 'Rédaction en chef' ) . $p( 'À compléter.' ) . $h( 'Chefs de pupitre' ) . $p( 'À compléter.' ) . $h( 'Journalistes' ) . $p( 'À compléter.' ) . $h( 'Nous joindre' ) . $p( 'Écrivez à l’adresse générique du journal (pas une adresse personnelle).' );
			case 'a-propos':
				return $p( "$nom est le journal étudiant indépendant de $eta." ) . $p( 'Notre mission : informer la communauté étudiante avec rigueur, équité et indépendance.' );
			case 'politique-de-correction':
				return $p( 'Nous corrigeons nos erreurs rapidement et ouvertement.' ) . $p( 'Toute correction importante est signalée à la fin de l’article, avec la date et la nature du changement. Une coquille est corrigée sans mention.' ) . $p( 'Pour signaler une erreur, écrivez à la rédaction en indiquant le lien de l’article.' );
			case 'deontologie':
				return $p( 'Nous suivons les principes du Guide de déontologie journalistique du Conseil de presse du Québec : exactitude, équité, indépendance, protection des personnes vulnérables et séparation claire entre information et opinion.' ) . $p( 'Les textes d’opinion sont identifiés comme tels. Les conflits d’intérêts sont déclarés.' );
		}
		return '';
	}
}
