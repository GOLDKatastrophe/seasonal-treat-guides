/* What each preview card is drawn from. Shared by render_previews.js (which
   records a digest per card) and check_build.js (which fails when a season's
   current inputs no longer match), so the two can't disagree. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (iso, withYear) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MON[m - 1]} ${d}` + (withYear ? `, ${y}` : '');
};

function seasons() {
  return fs.readdirSync('seasons').filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(fs.readFileSync(path.join('seasons', f), 'utf8')));
}

function cardInputs() {
  return seasons().map(s => {
    const { start, end } = s.runs;
    const sameYear = start.slice(0, 4) === end.slice(0, 4);
    return { slug: s.slug, title: s.title, year: s.year, theme: s.theme,
             dates: `${fmt(start, !sameYear)} – ${fmt(end, true)}` };
  });
}

function indexInputs() {
  // newest first, matching the landing page's order for past seasons
  const list = seasons().sort((a, b) => b.runs.start.localeCompare(a.runs.start));
  return { seasons: list.map(s => ({ title: s.title, year: s.year, accent: s.theme.accent })) };
}

const digest = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);

module.exports = { cardInputs, indexInputs, digest };
