#!/usr/bin/env node
/**
 * LE KIOSQUE — installateur du kit portable.
 *
 * Lancé par installer.sh / installer.cmd avec le Node embarqué dans le kit.
 * Aucune dépendance, aucun compte Azdak, aucun réseau sauf vers l'hébergement
 * DU JOURNAL. Cinq étapes; chacune est validée avant de passer à la suivante.
 *
 * Pause et reprise : taper « pause » à n'importe quelle question. Les réponses
 * sont gardées dans journal/installation-kiosque.json — JAMAIS le mot de passe,
 * redemandé à chaque séance parce qu'un fichier sur une clé USB se perd.
 */

import { spawnSync } from 'node:child_process';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOURNAL = path.join(KIT, 'journal');
const STATE_FILE = path.join(JOURNAL, 'installation-kiosque.json');
const CLI = path.join(KIT, 'packages', 'pipeline', 'src', 'cli.ts');
const AUTO = process.env.KIOSQUE_REPONSES ? JSON.parse(fs.readFileSync(process.env.KIOSQUE_REPONSES, 'utf8')) : null;

class Pause extends Error {}

// ── Affichage ────────────────────────────────────────────────────────────
const out = (s = '') => process.stdout.write(`${s}\n`);
const titre = (n, s) => out(`\n━━━━ Étape ${n} sur 5 — ${s} ━━━━`);
const ok = (s) => out(`  ✔ ${s}`);
const pb = (s) => out(`  ✘ ${s}`);

// ── Saisie ───────────────────────────────────────────────────────────────
let rl;
let muted = false;
function ensureRl() {
  if (rl) return;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  rl._writeToOutput = (s) => {
    if (!muted) rl.output.write(s);
    else if (s.includes('\n')) rl.output.write('\n');
  };
}
const lines = [];
let waiting = null;
function nextLine() {
  ensureRl();
  if (!nextLine.bound) {
    rl.on('line', (l) => (waiting ? (waiting(l), (waiting = null)) : lines.push(l)));
    rl.on('close', () => waiting && waiting(null));
    nextLine.bound = true;
  }
  return lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => (waiting = r));
}

/**
 * Pose une question. `aide` dit OÙ trouver la réponse; c'est le cœur du kit :
 * la personne devant l'écran n'est pas développeuse.
 */
async function demander(cle, { question, aide, defaut, secret = false, choix }) {
  if (AUTO && cle in AUTO) return String(AUTO[cle]);
  out(`\n  ${question}`);
  if (aide) for (const l of aide.trim().split('\n')) out(`    │ ${l.trim()}`);
  if (choix) choix.forEach((c, i) => out(`      ${i + 1}. ${c}`));
  const suffixe = defaut ? ` [${defaut}]` : '';
  process.stdout.write(`  → ${secret ? '(rien ne s’affiche pendant la saisie) ' : ''}${suffixe} `);
  muted = secret;
  const l = await nextLine();
  muted = false;
  if (l === null) throw new Pause();
  const v = l.trim();
  if (v.toLowerCase() === 'pause') throw new Pause();
  return v || defaut || '';
}

// ── État ─────────────────────────────────────────────────────────────────
function lireEtat() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { etapes: {}, reponses: {} };
  }
}
function sauver(etat) {
  // Ceinture et bretelles : aucune clé de mot de passe ne touche le disque.
  const copie = structuredClone(etat);
  for (const k of Object.keys(copie.reponses)) if (/pass|mot/i.test(k)) delete copie.reponses[k];
  copie.misAJour = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(copie, null, 2)}\n`);
}

// ── Aide « où trouver » ──────────────────────────────────────────────────
const AIDE = {
  type: `Si le journal a déjà un site WordPress ou un hébergement payé (Hostinger,
         OVH, o2switch, tout ce qui a un « cPanel »), choisissez 1 ou 3.
         Si l'établissement prête une machine ou un serveur, choisissez 2.
         Pour tester sans rien publier, choisissez 4.`,
  protocole: `SFTP est le plus sûr; choisissez-le s'il est offert.
         cPanel : Fichiers → Comptes FTP (FTP/FTPS), ou « Accès SSH » (SFTP).
         Hostinger (hPanel) : Sites web → Gérer → Fichiers → Comptes FTP;
           SFTP dans Avancé → Accès SSH (à activer).
         OVH : Espace client → Hébergements → onglet « FTP - SSH ».
         o2switch : cPanel → « Accès SSH » (SFTP) ou « Comptes FTP ».
         Serveur du campus : demandez au service informatique un accès SFTP.`,
  hote: `C'est l'adresse du serveur, pas celle du site.
         cPanel / o2switch : souvent le nom du domaine ou « ftp.mondomaine.ca ».
         Hostinger : « IP FTP » dans Comptes FTP (ex. 145.14.xx.xx).
         OVH : « Serveur FTP » dans l'onglet FTP - SSH (ex. ftp.cluster0xx.hosting.ovh.net).
         Service informatique : demandez « l'adresse du serveur SFTP ».`,
  port: `Laissez la valeur proposée sauf indication contraire.
         SFTP = 22 (o2switch et Hostinger SSH utilisent parfois 65002 ou 22).
         FTP et FTPS = 21.`,
  utilisateur: `L'identifiant du compte FTP/SSH, pas le courriel de connexion à l'hébergeur.
         Hostinger : « Nom d'utilisateur FTP » (ex. u123456789).
         OVH : « Login FTP principal ». o2switch / cPanel : le nom du compte cPanel.`,
  motdepasse: `Le mot de passe du compte FTP/SSH. Il n'est JAMAIS enregistré : on vous le
         redemandera si vous reprenez plus tard. Oublié ? Il se réinitialise
         dans la même page que l'identifiant.`,
  dossier: `Le dossier que le serveur web publie.
         cPanel / o2switch / Hostinger : public_html (ou public_html/journal
           pour un sous-dossier, par exemple à côté d'un WordPress existant).
         OVH : www.  Serveur Linux (nginx/Apache) : /var/www/html en général.
         ⚠ Avec un WordPress déjà en place, choisissez un SOUS-dossier
           (ex. public_html/journal) pour ne rien écraser.`,
  dossierLocal: `Un dossier de cette machine, d'une clé USB ou d'un partage réseau
         (ex. /media/USB/journal ou E:\\journal). Il sera créé au besoin.`,
  adresse: `L'adresse que les lecteurs taperont, avec https://.
         Domaine du journal : https://journal-exemple.ca
         Sous-dossier (ex. à côté d'un WordPress) : https://journal-exemple.ca/kiosque
         Le domaine se gère chez le registraire (souvent le même hébergeur) :
         zone DNS → un enregistrement A vers l'IP de l'hébergement.
         Service informatique : demandez « un sous-domaine qui pointe vers ce serveur ».`,
  nom: `Le nom du journal tel qu'il doit apparaître en haut du site.`,
};

// ── Outils réseau (curl et sftp sont livrés avec Windows 10+, macOS et Linux) ─
function curlProtocoles() {
  const r = spawnSync('curl', ['-V'], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  const l = r.stdout.split('\n').find((x) => x.startsWith('Protocols:')) ?? '';
  return l.replace('Protocols:', '').trim().split(/\s+/);
}

function urlDistante(r, relatif = '') {
  const proto = r.protocole === 'ftps' ? 'ftp' : r.protocole;
  let dossier = r.dossier.replace(/\\/g, '/').replace(/\/+$/, '');
  // FTP : chemin relatif au dossier de connexion; absolu = %2F. SFTP : ~ = maison.
  if (proto === 'sftp') dossier = dossier.startsWith('/') ? dossier : `~/${dossier}`;
  else dossier = dossier.startsWith('/') ? `%2F${dossier.slice(1)}` : dossier;
  const enc = relatif.split('/').map(encodeURIComponent).join('/');
  return `${proto}://${r.hote}:${r.port}/${dossier}/${enc}`;
}

function curl(r, mdp, lignes, extra = []) {
  const conf = [`user = "${r.utilisateur}:${mdp.replace(/(["\\])/g, '\\$1')}"`, ...lignes].join('\n');
  const args = ['-sS', '--connect-timeout', '15', '-K', '-', ...extra];
  if (r.protocole === 'ftps') args.push('--ssl-reqd');
  if (r.protocole === 'sftp') args.push('--insecure'); // empreinte : voir note du guide
  return spawnSync('curl', args, { input: conf, encoding: 'utf8' });
}

function sftpLot(r, commandes) {
  // Repli sans curl-sftp (Windows) : le client OpenSSH demande lui-même le mot de passe.
  const lot = path.join(KIT, '.lot-sftp.txt');
  fs.writeFileSync(lot, commandes.join('\n'));
  const res = spawnSync('sftp', ['-oBatchMode=no', '-P', String(r.port), '-b', lot, `${r.utilisateur}@${r.hote}`], { stdio: 'inherit' });
  fs.rmSync(lot, { force: true });
  return res.status === 0;
}

function lister(dir) {
  const res = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else res.push(path.relative(dir, f).split(path.sep).join('/'));
    }
  })(dir);
  return res;
}

// ── Étapes ───────────────────────────────────────────────────────────────
const TYPES = [
  'Hébergeur web mutualisé (cPanel, Hostinger, OVH, o2switch…) par SFTP ou FTP',
  'Serveur du journal ou du campus (VPS, machine Linux) par SFTP',
  'À côté d’un WordPress existant (dans un sous-dossier), par SFTP ou FTP',
  'Dossier local : clé USB, intranet, ou serveur où ce kit est branché',
  'GitHub Pages, Netlify ou Cloudflare Pages (je prépare un paquet à téléverser)',
];
const CODES = ['mutualise', 'serveur', 'wordpress', 'local', 'plateforme'];

async function etape1(e) {
  titre(1, 'Hébergement');
  const r = e.reponses;
  r.nom = await demander('nom', { question: 'Nom du journal ?', aide: AIDE.nom, defaut: r.nom });
  if (!r.nom) return pb('Le nom est requis.'), false;
  const c = await demander('type', { question: 'Où le site sera-t-il publié ? (numéro)', aide: AIDE.type, choix: TYPES, defaut: r.type ? String(CODES.indexOf(r.type) + 1) : undefined });
  const i = Number(c) - 1;
  if (!(i >= 0 && i < CODES.length)) return pb('Répondez par un numéro de 1 à 5.'), false;
  r.type = CODES[i];
  ok(`${r.nom} — ${TYPES[i]}`);
  return true;
}

let MDP = '';
async function etape2(e) {
  titre(2, 'Connexion');
  const r = e.reponses;
  if (r.type === 'plateforme') return ok('Rien à connecter : le paquet sera prêt à téléverser à l’étape 4.'), true;
  if (r.type === 'local') {
    r.dossier = await demander('dossier', { question: 'Dans quel dossier copier le site ?', aide: AIDE.dossierLocal, defaut: r.dossier });
    try {
      fs.mkdirSync(r.dossier, { recursive: true });
      fs.writeFileSync(path.join(r.dossier, '.kiosque-test'), 'ok');
      fs.rmSync(path.join(r.dossier, '.kiosque-test'));
      return ok(`Le dossier ${r.dossier} est accessible en écriture.`), true;
    } catch (err) {
      return pb(`Impossible d'écrire dans ${r.dossier} : ${err.message}`), false;
    }
  }
  const protos = r.type === 'serveur' ? ['sftp'] : ['sftp', 'ftps', 'ftp'];
  if (protos.length > 1) {
    const p = await demander('protocole', { question: 'Type d’accès ? (sftp, ftps ou ftp)', aide: AIDE.protocole, defaut: r.protocole ?? 'sftp' });
    if (!protos.includes(p.toLowerCase())) return pb('Répondez sftp, ftps ou ftp.'), false;
    r.protocole = p.toLowerCase();
  } else r.protocole = 'sftp';
  r.hote = await demander('hote', { question: 'Adresse du serveur (hôte) ?', aide: AIDE.hote, defaut: r.hote });
  r.port = await demander('port', { question: 'Port ?', aide: AIDE.port, defaut: r.port ?? (r.protocole === 'sftp' ? '22' : '21') });
  r.utilisateur = await demander('utilisateur', { question: 'Identifiant FTP/SSH ?', aide: AIDE.utilisateur, defaut: r.utilisateur });
  r.dossier = await demander('dossier', { question: 'Dossier web sur le serveur ?', aide: AIDE.dossier, defaut: r.dossier ?? (r.type === 'serveur' ? '/var/www/html' : r.type === 'wordpress' ? 'public_html/journal' : 'public_html') });
  if (!r.hote || !r.utilisateur || !/^\d+$/.test(r.port)) return pb('Hôte, identifiant et port (un nombre) sont requis.'), false;

  const viaCurl = curlProtocoles().includes(r.protocole === 'ftps' ? 'ftps' : r.protocole);
  r.outil = viaCurl ? 'curl' : 'sftp';
  if (viaCurl) MDP = (process.env.KIOSQUE_MOT_DE_PASSE ?? (await demander('motdepasse', { question: 'Mot de passe ?', aide: AIDE.motdepasse, secret: true })));
  out('  … test de connexion et d’écriture');
  if (r.outil === 'curl') {
    const test = path.join(KIT, '.kiosque-test');
    fs.writeFileSync(test, 'test du kit LE KIOSQUE\n');
    const res = curl(r, MDP, [`upload-file = "${test}"`, `url = "${urlDistante(r, '.kiosque-test')}"`], [
      '--ftp-create-dirs', '-Q', r.protocole === 'sftp' ? `-rm ${remoteSftpPath(r, '.kiosque-test')}` : '-DELE .kiosque-test',
    ]);
    fs.rmSync(test, { force: true });
    if (res.status !== 0) return pb(`Connexion refusée : ${res.stderr.trim()}\n    Vérifiez l’hôte, le port, l’identifiant et le mot de passe.`), false;
  } else if (!sftpLot(r, [`-mkdir ${r.dossier}`, `cd ${r.dossier}`, 'pwd'])) {
    return pb('Connexion SFTP refusée. Vérifiez l’hôte, le port, l’identifiant et le mot de passe.'), false;
  }
  return ok(`Connexion ${r.protocole.toUpperCase()} à ${r.hote} réussie, dossier ${r.dossier} accessible en écriture.`), true;
}
function remoteSftpPath(r, f) {
  // Commandes « quote » de curl en SFTP : un chemin relatif part du dossier
  // de connexion, comme le ~ de l'URL.
  return `"${r.dossier.replace(/\/+$/, '')}/${f}"`;
}

async function etape3(e) {
  titre(3, 'Adresse du site (domaine)');
  const r = e.reponses;
  const defaut = r.adresse ?? (r.type === 'local' ? 'http://localhost:8080' : undefined);
  const a = await demander('adresse', { question: 'Adresse publique du site ?', aide: AIDE.adresse, defaut });
  let u;
  try {
    u = new URL(a);
  } catch {
    return pb('Ce n’est pas une adresse complète. Exemple : https://journal-exemple.ca'), false;
  }
  r.adresse = u.href.replace(/\/+$/, '');
  r.basePath = u.pathname.replace(/\/+$/, '');
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) {
    try {
      const ip = await dns.lookup(u.hostname);
      ok(`${u.hostname} pointe vers ${ip.address}.`);
    } catch {
      pb(`${u.hostname} ne répond pas dans le DNS (domaine pas encore créé, ou pas d’Internet ici).`);
      const s = await demander('dnsContinuer', { question: 'Continuer quand même ? (oui/non)', defaut: 'non' });
      if (!/^o/i.test(s)) return false;
    }
  }
  ok(`Le site sera construit pour ${r.adresse} (sous-dossier : ${r.basePath || 'aucun'}).`);
  return true;
}

function node(args) {
  return spawnSync(process.execPath, [CLI, ...args, '--root', JOURNAL], { stdio: 'inherit' }).status === 0;
}

function personnaliser(r) {
  // Insertion textuelle : on garde les commentaires pédagogiques du fichier.
  const f = path.join(JOURNAL, 'content', 'publication.yml');
  let y = fs.readFileSync(f, 'utf8');
  y = y.replace(/^name:.*$/m, `name: ${JSON.stringify(r.nom)}`).replace(/^siteUrl:.*$/m, `siteUrl: ${r.adresse}`);
  fs.writeFileSync(f, y);
}

async function etape4(e) {
  titre(4, 'Publication');
  const r = e.reponses;
  personnaliser(r);
  out('  … diagnostic (kiosque doctor)');
  node(['doctor']);
  out('  … construction du site');
  if (!node(['build', '--base', r.basePath])) return pb('La construction a échoué : voir les messages ci-dessus.'), false;
  const dist = path.join(JOURNAL, 'dist');
  const fichiers = lister(dist);
  ok(`${fichiers.length} fichiers produits.`);

  if (r.type === 'plateforme') {
    const zip = path.join(KIT, 'site-a-televerser');
    fs.rmSync(zip, { recursive: true, force: true });
    fs.cpSync(dist, zip, { recursive: true });
    out(`  Dossier prêt : ${zip}
    Netlify : app.netlify.com/drop → glisser ce dossier.
    Cloudflare Pages : Workers & Pages → Créer → Pages → « Téléverser des fichiers ».
    GitHub Pages : préférez « Use this template » sur github.com/azdak919/le-kiosque.`);
    return true;
  }
  if (r.type === 'local') {
    fs.cpSync(dist, r.dossier, { recursive: true });
    return ok(`Site copié dans ${r.dossier}.`), true;
  }
  out(`  … envoi de ${fichiers.length} fichiers vers ${r.hote}`);
  if (r.outil === 'curl') {
    if (!MDP) MDP = process.env.KIOSQUE_MOT_DE_PASSE ?? (await demander('motdepasse', { question: 'Mot de passe (redemandé, jamais enregistré) ?', aide: AIDE.motdepasse, secret: true }));
    const lignes = fichiers.flatMap((f) => [`upload-file = "${path.join(dist, f)}"`, `url = "${urlDistante(r, f)}"`]);
    const res = curl(r, MDP, lignes, ['--ftp-create-dirs']);
    if (res.status !== 0) return pb(`Envoi interrompu : ${res.stderr.trim()}`), false;
  } else {
    const dirs = [...new Set(fichiers.map((f) => path.posix.dirname(f)).filter((d) => d !== '.'))].sort();
    const cmds = [`-mkdir ${r.dossier}`, ...dirs.map((d) => `-mkdir ${r.dossier}/${d}`), ...fichiers.map((f) => `put "${path.join(dist, f)}" "${r.dossier}/${f}"`)];
    if (!sftpLot(r, cmds)) return pb('Envoi SFTP interrompu.'), false;
  }
  return ok('Tous les fichiers sont envoyés.'), true;
}

async function etape5(e) {
  titre(5, 'Vérification en ligne');
  const r = e.reponses;
  if (r.type === 'plateforme') return ok('À vérifier après le téléversement : ouvrez l’adresse dans un navigateur.'), true;
  if (r.type === 'local' && r.adresse.startsWith('http://localhost')) {
    ok(`Pour l’ouvrir : servez ${r.dossier} (ex. python3 -m http.server 8080 --directory "${r.dossier}").`);
    return true;
  }
  const verifier = async (u) => {
    try {
      const res = await fetch(u, { redirect: 'follow' });
      return { code: res.status, texte: await res.text() };
    } catch (err) {
      return { code: 0, texte: String(err.cause?.code ?? err.message) };
    }
  };
  const accueil = await verifier(`${r.adresse}/`);
  const css = await verifier(`${r.adresse}/assets/theme.css`);
  if (accueil.code !== 200) return pb(`La page d’accueil répond ${accueil.code || accueil.texte}. Le dossier web est-il le bon ? Le domaine pointe-t-il vers l’hébergement ? (403 : droits des fichiers, à mettre à 644 et 755 dans le gestionnaire de fichiers.)`), false;
  const echappe = r.nom.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  if (!accueil.texte.includes(echappe) && !accueil.texte.includes(r.nom)) return pb('Une page répond, mais ce n’est pas le journal (ancien site ? mauvais dossier ?).'), false;
  if (css.code !== 200) return pb('La page s’affiche sans sa mise en forme : le sous-dossier de l’adresse ne correspond pas au dossier web.'), false;
  ok(`${r.adresse}/ est en ligne avec sa mise en forme.`);
  node(['adopt']);
  return true;
}

// ── Déroulement ──────────────────────────────────────────────────────────
const ETAPES = [etape1, etape2, etape3, etape4, etape5];
let etat;

async function main() {
  out('LE KIOSQUE — installation du journal (tapez « pause » à tout moment pour arrêter et reprendre plus tard)');
  etat = lireEtat();
  if (process.argv.includes('--recommencer')) etat.etapes = {};
  const faites = Object.keys(etat.etapes).length;
  if (faites && !AUTO) out(`Reprise : ${faites} étape(s) déjà validée(s). Lancez avec --recommencer pour tout reprendre.`);
  for (let i = 0; i < ETAPES.length; i++) {
    const n = String(i + 1);
    // Une connexion se reteste à chaque séance (le mot de passe n'est pas gardé).
    if (etat.etapes[n] && !(n === '2' && !etat.etapes['5'] && ['mutualise', 'serveur', 'wordpress'].includes(etat.reponses.type))) continue;
    let reussi = false;
    for (let essai = 0; !reussi; essai++) {
      reussi = await ETAPES[i](etat);
      if (!reussi && AUTO) throw new Error(`étape ${n} échouée`);
      if (!reussi) out('  Corrigez la réponse et réessayons (ou « pause »).');
    }
    etat.etapes[n] = new Date().toISOString();
    sauver(etat);
  }
  out('\nTerminé. Le journal vous appartient : gardez ce dossier (journal/) et PASSATION.md en lieu sûr.');
}

main()
  .catch((err) => {
    if (err instanceof Pause) {
      if (etat) sauver(etat);
      out(`\n⏸  En pause. Réponses gardées dans ${STATE_FILE} (sans mot de passe). Relancez l’installateur pour reprendre.`);
      return;
    }
    console.error(`\n✘ ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl?.close());
