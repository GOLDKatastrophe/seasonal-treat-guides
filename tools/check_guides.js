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

async function main() {
  const guides = JSON.parse(fs.readFileSync('data/guides.json', 'utf8'));
  fs.mkdirSync(TEXTDIR, { recursive: true });
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  const changed = [];
  let failed = 0;

  for (const g of guides) {
    let html;
    try {
      const res = await fetch(g.url, {
        headers: { 'user-agent': 'seasonal-treat-guides/1.0 (+github actions)' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      html = await res.text();
    } catch (e) {
      // A fetch failure is not a content change. Say so and leave state alone.
      console.log(`  !! ${g.id}: fetch failed (${e.message})`);
      failed++;
      continue;
    }

    // normalise() keeps the whole page when an anchor is missing, which would
    // fingerprint nav and related-post rails. Treat that as a failure instead.
    const missing = ['startAfter', 'endBefore'].filter(k => g[k] && !html.includes(g[k]));
    if (missing.length) {
      console.log(`  !! ${g.id}: anchor not found (${missing.map(k => `${k} "${g[k]}"`).join(', ')})`);
      failed++;
      continue;
    }

    const text = normalise(html, g);
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
      state[g.id] = { hash, checked: new Date().toISOString().slice(0, 10),
                      season: g.season, url: g.url };
    }
  }

  if (!reportOnly) fs.writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');

  const summary = changed.map(c => `${c.id} (${c.reason})`).join(', ');
  console.log(changed.length
    ? `\n${changed.length} guide(s) changed: ${summary}`
    : '\nno guide changed');

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
