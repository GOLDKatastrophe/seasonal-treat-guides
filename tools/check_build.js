#!/usr/bin/env node
/* Post-build checks. Runs in CI, so a bad season file fails the deploy
   rather than shipping a broken page. */
const fs = require('fs'), path = require('path');

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };

const seasons = fs.readdirSync('seasons').filter(f => f.endsWith('.json'));
ok(seasons.length > 0, `${seasons.length} season file(s) found`);

const slugs = [];
for (const f of seasons) {
  const s = JSON.parse(fs.readFileSync(path.join('seasons', f), 'utf8'));
  const slug = s.slug;
  slugs.push(slug);
  console.log(`\n${slug}`);

  ok(path.basename(f, '.json') === slug, 'filename matches slug');

  // --- data shape -------------------------------------------------------
  let n = 0, noCat = 0, noEnd = 0;
  const cats = new Set(['food', 'drink', 'booze', 'novelty']);
  const seen = new Set();
  let dupes = 0;
  for (const p of s.parks) for (const L of p.L) for (const sp of L.s) for (const it of sp.i) {
    n++;
    if ([...cats].filter(c => it.t.includes(c)).length !== 1) noCat++;
    if (!it.e) noEnd++;
    const k = `${sp.n}|${it.n}`;
    if (seen.has(k)) dupes++;
    seen.add(k);
  }
  ok(noCat === 0, `every item has exactly one category tag (${noCat} bad)`);
  ok(noEnd === 0, `every item has an end date (${noEnd} missing)`);
  ok(dupes === 0, `no duplicate item keys (${dupes} found)`);
  ok(n > 0, `${n} items`);

  // --- theme contrast ----------------------------------------------------
  const lum = h => {
    const v = h.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255)
      .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const t = s.theme;
  for (const [fg, bg, label] of [['ink', 'paper', 'body'], ['soft', 'card', 'muted'],
                                 ['accent', 'paper', 'accent'], ['warn', 'paper', 'warn'],
                                 ['want', 'card', 'star'], ['done', 'card', 'tick']]) {
    const r = ratio(t[fg], t[bg]);
    ok(r >= 4.5, `${label} contrast ${r.toFixed(2)}:1 (${t[fg]} on ${t[bg]})`);
  }

  // --- built output ------------------------------------------------------
  const page = path.join('dist', slug, 'index.html');
  ok(fs.existsSync(page), 'page built');
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8');
    const main = (html.match(/<main id="out">([\s\S]*?)<\/main>/) || [, ''])[1];
    const rows = (main.match(/<li[ >]/g) || []).length;
    ok(rows === n, `static prerender has all ${n} rows (${rows})`);
    ok(html.includes(`treats:${slug}`), 'storage key namespaced to this season');
    const others = slugs.filter(x => x !== slug);
    for (const o of others) {
      ok(!html.includes(`treats:${o}`), `no leakage from ${o}`);
    }
    ok(/<title>[^<]+<\/title>/.test(html), 'has a title');
  }
  for (const pdf of ['everything.pdf', 'highlights.pdf']) {
    const f2 = path.join('dist', slug, pdf);
    const exists = fs.existsSync(f2);
    ok(exists, `${pdf} rendered`);
    if (exists) {
      const head = fs.readFileSync(f2).subarray(0, 5).toString();
      ok(head === '%PDF-', `${pdf} is a real PDF`);
    }
  }
}

console.log('\nlanding page');
const idx = 'dist/index.html';
ok(fs.existsSync(idx), 'built');
if (fs.existsSync(idx)) {
  const html = fs.readFileSync(idx, 'utf8');
  for (const slug of slugs) ok(html.includes(`"${slug}/"`), `links to ${slug}`);
  ok(/not affiliated/i.test(html), 'carries the unaffiliated notice');
}

console.log(fails ? `\n${fails} check(s) failed\n` : '\nall checks passed\n');
process.exit(fails ? 1 : 0);
