/* Panneau « Le Kiosque » dans l'onglet Article de l'éditeur de blocs : chapeau,
   signatures multiples et crédit photo. Sans compilation (wp.* globaux). */
( function ( wp ) {
	const el = wp.element.createElement;
	const { TextareaControl, TextControl } = wp.components;
	const { useSelect, useDispatch } = wp.data;
	const Panneau = wp.editor.PluginDocumentSettingPanel;
	function Champs() {
		const type = useSelect( ( s ) => s( 'core/editor' ).getCurrentPostType(), [] );
		const meta = useSelect( ( s ) => s( 'core/editor' ).getEditedPostAttribute( 'meta' ) || {}, [] );
		const { editPost } = useDispatch( 'core/editor' );
		if ( type !== 'post' ) return null;
		const maj = ( cle ) => ( v ) => editPost( { meta: { ...meta, [ cle ]: v } } );
		return el( Panneau, { name: 'le-kiosque', title: 'Le Kiosque', initialOpen: true },
			el( TextareaControl, { label: 'Chapeau', help: 'Deux ou trois lignes sous le titre.', value: meta.kiosque_chapeau || '', onChange: maj( 'kiosque_chapeau' ), id: 'kiosque-chapeau' } ),
			el( TextareaControl, { label: 'Signatures', help: 'Une personne par ligne.', value: meta.kiosque_signatures || '', onChange: maj( 'kiosque_signatures' ), id: 'kiosque-signatures' } ),
			el( TextControl, { label: 'Crédit photo', value: meta.kiosque_credit_photo || '', onChange: maj( 'kiosque_credit_photo' ), id: 'kiosque-credit' } )
		);
	}
	wp.plugins.registerPlugin( 'le-kiosque', { render: Champs } );
} )( window.wp );
