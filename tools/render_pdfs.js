#!/usr/bin/env node
/* Render a season's static PDFs using the very same generator the page ships,
   so the downloads can never drift from what the page shows.
   usage: node render_pdfs.js <built-page.html> <out-dir> */
const fs = require('fs'), path = require('path'), vm = require('vm');

const [page, outDir] = process.argv.slice(2);
if (!page || !outDir) { console.error('usage: render_pdfs.js <page.html> <out-dir>'); process.exit(1); }

const html = fs.readFileSync(page, 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];

// The page's script touches the DOM on load; give it just enough to run.
const noop = () => {};
const el = () => ({ classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
  dataset:{}, style:{}, set innerHTML(v){}, get innerHTML(){return '';},
  textContent:'', value:'', addEventListener:noop, setAttribute:noop,
  getAttribute:()=>null, appendChild:noop, remove:noop, click:noop });
const sandbox = {
  console, Buffer, module: { exports: {} },
  document: { documentElement:{classList:{add:noop,remove:noop}},
              body:{classList:{add:noop,remove:noop},appendChild:noop},
              getElementById: el, querySelectorAll: () => [],
              createElement: el, addEventListener: noop },
  window: { addEventListener: noop, matchMedia: () => ({matches:false,addListener:noop,removeListener:noop}) },
  location: { origin:'https://example.invalid', pathname:'/', search:'', hash:'' },
  history: { replaceState: noop },
  navigator: {}, localStorage: { getItem:()=>null, setItem:noop, removeItem:noop },
  setTimeout: () => 0, clearTimeout: noop, prompt: noop, confirm: () => false,
  btoa: b => Buffer.from(b, 'binary').toString('base64'),
  atob: b => Buffer.from(b, 'base64').toString('binary'),
  URL: { createObjectURL: () => '', revokeObjectURL: noop },
  Blob: class {}, File: class {},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: path.basename(page) });

const { wishPDF, SEASON, D } = sandbox.module.exports;
if (!wishPDF) { console.error('page did not export wishPDF'); process.exit(1); }

const count = pick => {
  let n = 0;
  for (const p of D) for (const L of p.L) for (const s of L.s)
    for (const it of s.i) if (pick(s, it)) n++;
  return n;
};

const variants = [
  { file: 'everything.pdf', pick: () => true,
    heading: `${SEASON.title} ${SEASON.year}`,
    sub: 'Disneyland Resort · every seasonal item, by park and land' },
  { file: 'highlights.pdf', pick: (s, it) => it.t.includes('new'),
    heading: `${SEASON.title} ${SEASON.year} — New this year`,
    sub: 'Disneyland Resort · items new for this season' },
];

fs.mkdirSync(outDir, { recursive: true });
const manifest = [];
for (const v of variants) {
  const n = count(v.pick);
  const label = v.file.replace('.pdf', '');
  const bytes = wishPDF(v.pick, {
    heading: v.heading,
    sub: `${v.sub} · ${n} items`,
    foot: `${SEASON.title} ${SEASON.year} · ${label}`,
  });
  const dest = path.join(outDir, v.file);
  fs.writeFileSync(dest, Buffer.from(bytes));
  manifest.push({ file: v.file, count: n, bytes: bytes.length });
  console.log(`  ${v.file}: ${n} items, ${(bytes.length/1024).toFixed(1)} KB`);
}
fs.writeFileSync(path.join(outDir, 'pdf-manifest.json'), JSON.stringify(manifest, null, 1));
