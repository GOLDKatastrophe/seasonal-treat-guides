#!/usr/bin/env node
/* Render the 1200x630 link-preview cards (og:image) that Reddit, iMessage,
   Slack and the like show when a page is shared.

     node tools/render_previews.js     # or: make previews

   Writes previews/<slug>.png for each season, previews/index.png for the
   landing page, and previews/manifest.json recording what each card was drawn
   from. The PNGs are committed; `make check` fails when a card's inputs no
   longer match the manifest, so a retitled or recoloured season can't ship a
   stale preview.

   Needs Chrome or Chromium (no npm packages). Set CHROME to its path if it
   isn't found. GitHub's ubuntu runners have google-chrome installed.

   The cards deliberately carry no domain name: the site's address is set
   once, as SITE_URL in the Makefile, and only appears in the page tags. */
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { cardInputs, indexInputs, digest } = require('./preview_inputs.js');

const OUT = 'previews';
const W = 1200, H = 630;

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function findChrome() {
  const c = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  try {   // Playwright's bundled browser, if present
    for (const d of fs.readdirSync('/opt/pw-browsers')) c.push(path.join('/opt/pw-browsers', d, 'chrome-linux', 'chrome'));
  } catch (e) {}
  for (const b of c.filter(Boolean)) {
    try { execFileSync(b, ['--version'], { stdio: 'ignore' }); return b; } catch (e) {}
  }
  console.error('render_previews: no Chrome/Chromium found. Install one or set CHROME=/path/to/chrome.');
  process.exit(1);
}

const BASE = `
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{font-family:Georgia,"DejaVu Serif","Liberation Serif",serif;-webkit-font-smoothing:antialiased}
  .sans{font-family:"Helvetica Neue",Arial,"Liberation Sans","DejaVu Sans",sans-serif}`;

function seasonCard(s) {
  const t = s.theme;
  const dots = [t.accent, t.accent2, t.done, t.accent, t.want, t.accent2, t.done, t.accent];
  return `<!doctype html><meta charset="utf-8"><style>${BASE}
  body{background:${t.paper};color:${t.ink};padding:56px 64px}
  .card{position:absolute;inset:40px;border:2px solid ${t.rule};border-radius:28px;background:${t.card}}
  .bar{position:absolute;left:40px;top:40px;bottom:40px;width:14px;border-radius:28px 0 0 28px;background:${t.accent}}
  .in{position:absolute;left:104px;right:96px;top:92px;bottom:84px;display:flex;flex-direction:column}
  .kick{font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:${t.soft}}
  h1{font-size:${s.title.length > 18 ? 84 : 96}px;line-height:1.02;font-weight:600;margin-top:22px}
  h1 span{color:${t.accent}}
  .sub{font-size:31px;color:${t.soft};margin-top:22px}
  .foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
  .what{font-size:27px;color:${t.ink}}
  .dots{display:flex;gap:14px}
  .dots i{width:22px;height:22px;border-radius:50%;display:block}
  </style>
  <div class="card"></div><div class="bar"></div>
  <div class="in">
    <div class="kick sans">Disneyland Resort · Unofficial guide</div>
    <h1>${esc(s.title)} <span>${esc(s.year)}</span></h1>
    <div class="sub sans">${esc(s.dates)}</div>
    <div class="foot">
      <div class="what sans">Every seasonal food &amp; drink, by park and land</div>
      <div class="dots">${dots.map(c => `<i style="background:${c}"></i>`).join('')}</div>
    </div>
  </div>`;
}

function indexCard(ix) {
  const rows = ix.seasons.slice(0, 4).map(s => `
    <div class="row"><i style="background:${s.accent}"></i><b>${esc(s.title)} ${esc(s.year)}</b></div>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>${BASE}
  body{background:#14141A;color:#F2EFE6}
  .card{position:absolute;inset:40px;border:2px solid #343243;border-radius:28px;background:#1F1F29}
  .in{position:absolute;left:96px;right:96px;top:92px;bottom:84px;display:flex;flex-direction:column}
  .kick{font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:#A7A3B5}
  h1{font-size:76px;line-height:1.05;font-weight:600;margin-top:20px}
  .rows{margin-top:auto}
  .row{display:flex;align-items:center;gap:20px;font-size:34px;margin-top:16px}
  .row i{width:26px;height:26px;border-radius:50%;display:block;flex:none}
  .row b{font-weight:500}
  </style>
  <div class="card"></div>
  <div class="in">
    <div class="kick sans">Disneyland Resort · Unofficial guides</div>
    <h1>Seasonal treat checklists</h1>
    <div class="rows">${rows}</div>
  </div>`;
}

function render(chrome, html, out) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-'));
  const page = path.join(tmp, 'card.html');
  fs.writeFileSync(page, html);
  execFileSync(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${W},${H}`, `--screenshot=${path.resolve(out)}`,
    'file://' + page], { stdio: 'ignore' });
  fs.rmSync(tmp, { recursive: true, force: true });
  const png = fs.readFileSync(out);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  if (w !== W || h !== H) { console.error(`render_previews: ${out} is ${w}x${h}, expected ${W}x${H}`); process.exit(1); }
  console.log(`  wrote ${out} (${W}x${H}, ${(png.length / 1024).toFixed(0)} KB)`);
}

if (require.main === module) {
  const chrome = findChrome();
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {};
  for (const s of cardInputs()) {
    render(chrome, seasonCard(s), path.join(OUT, s.slug + '.png'));
    manifest[s.slug] = digest(s);
  }
  const ix = indexInputs();
  render(chrome, indexCard(ix), path.join(OUT, 'index.png'));
  manifest.index = digest(ix);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
}
