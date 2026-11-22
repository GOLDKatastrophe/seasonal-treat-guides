#!/usr/bin/env node
/* Fetch each watched Disney foodie guide, normalise it to plain text, and
   compare against the fingerprint recorded last time.

   This runs first in CI and costs nothing. Only when a page has actually
   changed does the workflow spend a Claude run on working out what changed.

     node tools/check_guides.js          # report, update state, exit 0
     node tools/check_guides.js --check  # report only, exit 1 if changed

   Writes:
     data/guide-state.json   fingerprints
     data/guides/<id>.txt    normalised text, committed so PR diffs are real
*/
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const STATE = 'data/guide-state.json';
const TEXTDIR = 'data/guides';
const reportOnly = process.argv.includes('--check');


/* Strip to the article body, then to plain text. Disney's pages carry nav,
   related-posts rails and rotating promos that would otherwise churn the
   fingerprint every week, so each guide names its own start/end anchors. */
function normalise(html, g) {
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  if (g.startAfter) {
    const i = t.indexOf(g.startAfter);
    if (i !== -1) t = t.slice(i);
  }
  if (g.endBefore) {
    const i = t.lastIndexOf(g.endBefore);
    if (i !== -1) t = t.slice(0, i);
  }
  t = decodeEntities(t.replace(/<[^>]+>/g, '\n'));
  let lines = t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  lines = collapseRepeats(lines);
  return lines.join('\n') + '\n';
}

const NAMED = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  mdash: '—', ndash: '–', hellip: '…', middot: '·',
  eacute: 'é', egrave: 'è', ntilde: 'ñ', ccedil: 'ç',
  oacute: 'ó', auml: 'ä', iuml: 'ï', aacute: 'á',
  iacute: 'í', uuml: 'ü', ouml: 'ö', agrave: 'à' };

/* Decode rather than strip: Disney's markup flips between &eacute; and a
   literal e-acute, and stripping either way would move the fingerprint for
   no real change. */
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

/* Each entry is emitted two or three times in a row, and the repeats are
   interleaved (name, description, name, description...), so collapsing
   adjacent identical *lines* misses them. Collapse adjacent identical
   *blocks* instead, longest first. Items that genuinely recur at different
   locations are not adjacent, so they survive. */
function collapseRepeats(lines, maxBlock = 10) {
  for (let k = maxBlock; k >= 1; k--) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      out.push(lines[i]);
      // if the block starting here repeats immediately, skip the copies
      if (i + 2 * k <= lines.length) {
        const a = lines.slice(i, i + k).join('\u0000');
        let j = i + k;
        while (j + k <= lines.length && lines.slice(j, j + k).join('\u0000') === a) j += k;
        if (j > i + k) {
          for (let m = i + 1; m < i + k; m++) out.push(lines[m]);
          i = j;
          continue;
        }
      }
      i++;
    }
    lines = out;
  }
  return lines;
}

const D = require('./discover_guides.js');
const GUIDES = 'data/guides.json';
const INDEX = 'data/guide-index.json';
const FREEZE_DAYS = 14;   // stop watching a season this long after it ends

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'seasonal-treat-guides/1.0 (+github actions)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

const readJSON = (f, dflt) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : dflt;
const seasonFile = slug => path.join('seasons', slug + '.json');

/* A season is frozen (archived, no longer watched) FREEZE_DAYS after it ends.
   Disney tidies ended guides; the archive keeps what the season offered. */
function frozen(slug, today) {
  const f = seasonFile(slug);
  if (!fs.existsSync(f)) return false;
  const end = new Date(JSON.parse(fs.readFileSync(f, 'utf8')).runs.end + 'T00:00:00Z');
  return (today - end) / 864e5 > FREEZE_DAYS;
}

/* Add a guide to the watch list for a season, unless one already watches
   that URL for that season. */
function register(guides, url, season, why, found) {
  if (guides.some(g => g.url === url && g.season === season)) return null;
  const g = { id: D.guideId(url, season), season, url };
  guides.push(g);
  const isNew = !fs.existsSync(seasonFile(season));
  found.push(`${g.id} → ${season}${isNew ? ' (new season)' : ''} [${why}]`);
  console.log(`  ++ ${g.id}: ${why}; watching for ${season}${isNew ? ' (new season)' : ''}`);
  return g;
}

function seasonRuns() {
  const out = {};
  for (const f of fs.readdirSync('seasons').filter(f => f.endsWith('.json'))) {
    const s = JSON.parse(fs.readFileSync(path.join('seasons', f), 'utf8'));
    out[s.slug] = s.runs;
  }
  return out;
}

async function main() {
  const seed = process.argv.includes('--seed');
  const runs = seasonRuns();
  const today = new Date();
  const guides = readJSON(GUIDES, []);
  const index = readJSON(INDEX, {});
  fs.mkdirSync(TEXTDIR, { recursive: true });
  const state = readJSON(STATE, {});
  const changed = [], found = [];
  let failed = 0;

  // --- 1. discovery: new guides on Disney's foodie-guide index ------------
  const links = new Set();
  let indexOk = 0;
  for (const u of D.INDEX_PAGES) {
    try { D.guideLinks(await fetchText(u)).forEach(l => links.add(l)); indexOk++; }
    catch (e) { console.log(`  !! index ${u}: fetch failed (${e.message})`); }
  }
  if (!indexOk) failed++;
  for (const url of links) {
    if (index[url] && !seed) continue;         // seen; republishing is caught in step 2
    let meta;
    try { meta = D.pageMeta(await fetchText(url)); }
    catch (e) { console.log(`  !! ${url}: fetch failed (${e.message})`); failed++; continue; }
    const season = D.seasonFor(D.classify(url), meta.published, runs);
    if (!season) { console.log(`  !! ${url}: no publish date`); failed++; continue; }
    index[url] = { season, published: meta.published, title: meta.title };
    if (!seed) register(guides, url, season, 'new guide', found);
  }
  if (seed) console.log(`  seeded ${Object.keys(index).length} known guide(s); none added`);

  // --- 2. fetch and fingerprint each watched guide -------------------------
  for (let k = 0; k < guides.length; k++) {
    const g = guides[k];
    if (g.archived) { console.log(`  -- ${g.id}: archived`); continue; }
    if (frozen(g.season, today)) { console.log(`  -- ${g.id}: ${g.season} ended; frozen`); continue; }
    let html;
    try { html = await fetchText(g.url); }
    catch (e) {
      // A fetch failure is not a content change. Say so and leave state alone.
      console.log(`  !! ${g.id}: fetch failed (${e.message})`);
      failed++;
      continue;
    }

    // Same page republished for a new year: that's a new season. Archive this
    // entry untouched and watch the page for the new season instead.
    const meta = D.pageMeta(html);
    const nowSeason = D.seasonFor(D.classify(g.url), meta.published, runs);
    if (nowSeason && nowSeason !== g.season && Number(nowSeason.slice(-4)) > Number(g.season.slice(-4))) {
      g.archived = true;
      console.log(`  -- ${g.id}: republished for ${nowSeason}; archiving ${g.season}'s copy`);
      index[g.url] = { season: nowSeason, published: meta.published, title: meta.title };
      register(guides, g.url, nowSeason, `republished for ${nowSeason}`, found);
      continue;   // the new entry is later in the list and is fetched below
    }

    let body = html;
    if (g.startAfter || g.endBefore) {
      // normalise() keeps the whole page when an anchor is missing, which would
      // fingerprint nav and related-post rails. Treat that as a failure instead.
      const missing = ['startAfter', 'endBefore'].filter(f => g[f] && !html.includes(g[f]));
      if (missing.length) {
        console.log(`  !! ${g.id}: anchor not found (${missing.map(f => `${f} "${g[f]}"`).join(', ')})`);
        failed++;
        continue;
      }
    } else {
      body = D.articleBody(html);
      if (!body) { console.log(`  !! ${g.id}: article body not found (page layout changed?)`); failed++; continue; }
    }

    const text = normalise(body, g);
    const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
    const prev = state[g.id];
    const file = path.join(TEXTDIR, g.id + '.txt');

    if (!prev) {
      console.log(`  ++ ${g.id}: first seen (${text.split('\n').length} lines)`);
      changed.push({ ...g, reason: 'first seen' });
    } else if (prev.hash !== hash) {
      const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : [];
      const now = text.split('\n');
      const added = now.filter(l => !old.includes(l)).length;
      const gone = old.filter(l => !now.includes(l)).length;
      console.log(`  ~~ ${g.id}: changed (+${added} / -${gone} lines)`);
      changed.push({ ...g, reason: `+${added} / -${gone} lines`, added, gone });
    } else {
      console.log(`  == ${g.id}: unchanged`);
    }

    if (!reportOnly) {
      fs.writeFileSync(file, text);
      state[g.id] = { hash, season: g.season, url: g.url, published: meta.published };
    }
  }

  if (!reportOnly) {
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');
    fs.writeFileSync(GUIDES, JSON.stringify(guides, null, 1) + '\n');
    fs.writeFileSync(INDEX, JSON.stringify(index, null, 1) + '\n');
  }

  const newSeasons = [...new Set(guides.filter(g => !g.archived && !fs.existsSync(seasonFile(g.season))).map(g => g.season))];
  const summary = [
    ...newSeasons.map(s => `new season ${s}`),
    ...changed.map(c => `${c.id} (${c.reason})`),
  ].join(', ');
  console.log(found.length ? `\nnew: ${found.join('; ')}` : '');
  console.log(changed.length ? `\n${changed.length} guide(s) changed: ${summary}` : '\nno guide changed');

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `changed=${changed.length ? 'true' : 'false'}\n` +
      `summary=${summary}\n` +
      `fetch_failures=${failed}\n`);
  }
  if (reportOnly && changed.length) process.exit(1);
}

if (require.main === module) main();

module.exports = { normalise, decodeEntities, collapseRepeats };
