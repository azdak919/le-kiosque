# LE KIOSQUE — installer le journal en une séance

Ce kit fonctionne **sans Internet** (sauf pour joindre VOTRE hébergement),
**sans compte Azdak** et sans rien installer : Node est inclus. Le journal reste
propriétaire de tout : domaine, hébergement, comptes, contenus.

## Avant la rencontre (10 min)
Imprimez `FICHE-A-IMPRIMER.html` et faites-la remplir par l'hébergeur ou le
service informatique. Sans ces réponses, on peut quand même faire l'étape 4
en « dossier local » pour montrer le site.

## Lancer
- **Windows** : double-cliquez `installer.cmd`.
- **macOS / Linux** : ouvrez un terminal dans ce dossier et tapez `./installer.sh`.

## Les 5 étapes (chacune est vérifiée avant la suivante)
1. **Hébergement** — nom du journal, et où publier : hébergeur mutualisé
   (cPanel, Hostinger, OVH, o2switch), serveur du campus, à côté d'un
   WordPress (sous-dossier), dossier local/clé USB, ou GitHub Pages / Netlify /
   Cloudflare Pages.
2. **Connexion** — SFTP ou FTP : hôte, port, identifiant, dossier web,
   mot de passe. Le kit **teste la connexion et l'écriture** tout de suite.
3. **Adresse** — l'adresse publique (domaine ou sous-dossier). Le kit vérifie
   le DNS.
4. **Publication** — diagnostic (`doctor`), construction du site, envoi.
5. **Vérification** — le kit ouvre l'adresse et contrôle la page et sa mise en
   forme, puis écrit `journal/PASSATION.md`.

**Pause** : tapez `pause` à n'importe quelle question. Les réponses sont gardées
dans `journal/installation-kiosque.json` — **jamais le mot de passe**. Relancez
l'installateur pour reprendre là où vous étiez (`--recommencer` pour tout refaire).

## Ensuite
- Écrire un article : `journal/AJOUTER-UN-ARTICLE.md`.
- Republier après une modification : relancez l'installateur (les étapes 1 à 3
  sont déjà validées; on vous redemande seulement le mot de passe).
- Sauvegarder : copiez le dossier `journal/` (textes + images = l'archive).

## Si ça bloque
| Message | Cause probable |
|---|---|
| Connexion refusée | hôte, port, identifiant ou mot de passe; SFTP pas activé chez l'hébergeur |
| Domaine ne répond pas dans le DNS | domaine pas encore pointé vers l'hébergement (24 h max) |
| Page sans mise en forme | l'adresse et le dossier web ne correspondent pas (sous-dossier) |
| Une page répond, mais pas le journal | ancien `index.html` ou mauvais dossier web |

Note SFTP : le kit accepte la clé du serveur sans la comparer. Pour un serveur
sensible, demandez son empreinte au service informatique et vérifiez-la avec
`ssh-keyscan`.
