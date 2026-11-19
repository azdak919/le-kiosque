/**
 * Colonne de droite de l'accueil quand « En bref » est vide (petit journal :
 * 4 articles ou moins, tous déjà dans la une). Plutôt qu'un grand vide : le
 * tableau sportif (seul contenu qui n'est pas déjà à gauche) et les rubriques,
 * avec leur nombre d'articles, puis les archives. Rien si les deux manquent.
 *
 * Partagé par le build statique (templates.ts) et le site vivant (render.js).
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);
const link = (base, path) => `${String(base || '').replace(/\/+$/, '')}${path}`;

function shortDay(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone }).format(new Date(`${String(iso).slice(0, 10)}T12:00:00Z`));
  } catch {
    return String(iso || '');
  }
}

/** Équipes du tableau sportif (même lecture que la page Au tableau). */
function sportsTeams(sports) {
  if (!sports || sports.enabled === false) return [];
  if (Array.isArray(sports.teams) && sports.teams.length) {
    // Résultats rangés dans l'équipe, ou à plat avec teamId (fichiers du site statique).
    return sports.teams.map((team) => ({
      ...team,
      results: team.results?.length ? team.results : (sports.results || []).filter((item) => item.teamId === team.id),
      nextGame: team.nextGame || (sports.nextGames || []).find((item) => item.teamId === team.id) || (sports.nextGame?.teamId === team.id ? sports.nextGame : undefined),
    }));
  }
  return sports.team ? [{ ...sports.team, results: sports.results, nextGame: sports.nextGame }] : [];
}

export function homeRailHtml({ publication, sections = [], articles = [], base = '', linkAttributes = 'data-editorial-link' }) {
  const timeZone = publication?.timeZone || 'America/Toronto';
  const attr = linkAttributes ? ` ${linkAttributes}` : '';
  const rows = sportsTeams(publication?.masthead?.sports).map((team) => {
    const last = [...(team.results || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const next = team.nextGame;
    if (!last && !next) return '';
    const who = `<span class="home-rail__team">${esc(team.name)}</span> <span class="home-rail__sport">${esc(team.sport || '')}</span>`;
    const tone = last ? (last.result === 'W' ? 'v' : last.result === 'L' ? 'd' : 'n') : '';
    const score = last
      ? `<span class="home-rail__line"><span class="home-rail__score home-rail__score--${tone}">${Number(last.scoreFor)}–${Number(last.scoreAgainst)}</span> ${esc(last.opponent || '')} <span class="home-rail__when">${esc(shortDay(last.date, timeZone))}</span></span>`
      : '';
    const upcoming = next
      ? `<span class="home-rail__line home-rail__next">Prochain match : ${esc(next.opponent || '')}, ${esc(shortDay(next.date, timeZone))}${next.time ? ` à ${esc(String(next.time).replace(':', ' h '))}` : ''}</span>`
      : '';
    return `<li>${who}${score}${upcoming}</li>`;
  }).filter(Boolean);
  const boxes = [];
  if (rows.length) {
    boxes.push(`<section class="home-rail__box" aria-labelledby="home-rail-sports"><h2 id="home-rail-sports">Au tableau</h2><ul class="home-rail__list">${rows.join('')}</ul><a class="home-rail__more"${attr} href="${esc(link(base, '/sports/'))}">Tous les résultats →</a></section>`);
  }
  const counted = sections
    .map((section) => ({ section, count: articles.filter((article) => article.section === section.slug).length }))
    .filter((item) => item.count > 0);
  if (counted.length) {
    const items = counted.map(({ section, count }) => `<li><a${attr} href="${esc(link(base, `/sections/${encodeURIComponent(section.slug)}/`))}"${section.color ? ` style="--c:${esc(section.color)}"` : ''}>${esc(section.name)}</a><span class="home-rail__count">${count} article${count > 1 ? 's' : ''}</span></li>`).join('');
    boxes.push(`<section class="home-rail__box" aria-labelledby="home-rail-rubriques"><h2 id="home-rail-rubriques">Rubriques</h2><ul class="home-rail__list home-rail__list--rubriques">${items}</ul><a class="home-rail__more"${attr} href="${esc(link(base, '/archives/'))}">Toutes les archives →</a></section>`);
  }
  return boxes.length ? `<aside class="brief-rail home-rail" aria-label="Au journal">${boxes.join('')}</aside>` : '';
}
