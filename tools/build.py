#!/usr/bin/env python3
"""Build one season page from the shared shell + a season JSON.

The shell is the Halloween page; everything season-specific is replaced
here, so adding a season means adding a JSON file, not editing HTML.
"""
import io, json, re, sys, html, os

SHELL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shell.html')

def esc(t):
    return html.escape(str(t), quote=True)

def fail(msg):
    sys.exit('BUILD FAILED: ' + msg)

def sub1(s, old, new, label):
    if s.count(old) != 1:
        fail(f'{label}: {s.count(old)} matches, expected 1')
    return s.replace(old, new, 1)

def slugify(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')

def build(season_path, out_path):
    season = json.load(open(season_path, encoding='utf-8'))
    s = io.open(SHELL, encoding='utf-8').read()
    th = season['theme']
    parks = season['parks']

    # ---------------------------------------------------------- theme tokens
    old_root = re.search(r'  :root\{\n(?:    --[a-z0-9]+:#[0-9A-Fa-f]{6};\n)+', s)
    if not old_root:
        fail('could not find :root token block')
    tokens = [('paper', th['paper']), ('card', th['card']), ('ink', th['ink']),
              ('soft', th['soft']), ('rule', th['rule']),
              ('pumpkin', th['accent']), ('wine', th['warn']),
              ('done', th['done']), ('want', th['want'])]
    s = s.replace(old_root.group(0),
                  '  :root{\n' + ''.join(f'    --{k}:{v};\n' for k, v in tokens), 1)

    # ---------------------------------------------------------- header
    s = sub1(s, '  <h1>Halloween Time Treats</h1>',
             f'  <h1>{esc(season["title"])}</h1>', 'h1')
    s = sub1(s, '  <p class="sub">Disneyland Resort · Aug 21 – Oct 31, 2026</p>',
             f'  <p class="sub">{esc(season["subtitle"])}</p>', 'subtitle')

    # ---------------------------------------------------------- chips
    chips = []
    for c in season['chips']:
        cls = 'chip'
        if c['f'] in ('gone', 'short'):
            cls += ' warn'
        if c['f'] == 'want':
            cls += ' mine'
        chips.append(f'    <button class="{cls}" data-f="{c["f"]}" '
                     f'aria-pressed="false">{esc(c["label"])}</button>')
    # dividers before the category run and before the personal run
    cats = [i for i, c in enumerate(season['chips']) if c['f'] == 'food']
    pers = [i for i, c in enumerate(season['chips']) if c['f'] == 'todo']
    for i in sorted(cats + pers, reverse=True):
        chips.insert(i, '    <span class="chipdiv" aria-hidden="true"></span>')
    old_chips = re.search(r'  <div class="chips">\n(?:    <(?:button|span)[^\n]*\n)+  </div>', s)
    if not old_chips:
        fail('could not find chips block')
    s = s.replace(old_chips.group(0),
                  '  <div class="chips">\n' + '\n'.join(chips) + '\n  </div>', 1)

    # ---------------------------------------------------------- nav
    nav = ''.join(f'<a href="#{slugify(p["p"])}">{esc(p["p"])}</a>' for p in parks)
    s = re.sub(r'<nav id="nav">.*?</nav>', f'<nav id="nav">{nav}</nav>', s, count=1, flags=re.S)

    # ---------------------------------------------------------- PDF row
    # Buttons, not links: the page builds these from its own data on demand,
    # so a download can never disagree with what is on screen.
    n_all = sum(len(sp['i']) for p in parks for L in p['L'] for sp in L['s'])
    n_new = sum(1 for p in parks for L in p['L'] for sp in L['s']
                for it in sp['i'] if 'new' in it['t'])
    block = (
        '<div class="files">\n'
        '  <span>Printable PDFs</span>\n'
        f'  <button class="pdfbtn" id="pdf-all">Everything &middot; {n_all}</button>\n'
        f'  <button class="pdfbtn" id="pdf-new">New this year &middot; {n_new}</button>\n'
        '</div>')
    old_files = re.search(r'<div class="files">.*?</div>\n\n', s, re.S)
    if not old_files:
        fail('could not find files row')
    s = s.replace(old_files.group(0), (block + '\n\n') if block else '', 1)

    # ---------------------------------------------------------- print header
    s = sub1(s, '  <h1>Halloween Time Treats — Disneyland Resort</h1>',
             f'  <h1>{esc(season["title"])} — Disneyland Resort</h1>', 'printhead h1')
    s = sub1(s,
             "  <p>Aug 21 – Oct 31, 2026. Checked boxes are what's already been tried.</p>",
             f'  <p>{esc(season["subtitle"])}. '
             "Checked boxes are what's already been tried.</p>", 'printhead p')

    # ---------------------------------------------------------- static prerender
    out = []
    for p in parks:
        out.append(f'<h2 class="park" id="{slugify(p["p"])}">{esc(p["p"])}</h2>')
        for L in p['L']:
            out.append(f'<div class="land">{esc(L["l"])}</div>')
            for sp in L['s']:
                out.append('<div class="spot">')
                out.append(f'<h3>{esc(sp["n"])}</h3>')
                if sp.get('m'):
                    out.append(f'<p class="meta">{esc(sp["m"])}</p>')
                out.append('<ul>')
                for it in sp['i']:
                    tags = ''
                    if 'new' in it['t']:
                        tags += '<span class="tag new">New</span>'
                    if 'booze' in it['t']:
                        tags += '<span class="tag age">21+</span>'
                    if 'novelty' in it['t']:
                        tags += '<span class="tag">Novelty</span>'
                    desc = f'<span class="d">{esc(it["d"])}</span>' if it.get('d') else ''
                    out.append(
                        '<li><span class="box">✓</span><span class="txt">'
                        f'<span class="n">{esc(it["n"])}</span>{desc}'
                        f'<span class="tags">{tags}'
                        f'<span class="tag end">ends {esc(it["e"])}</span>'
                        '</span></span></li>')
                out.append('</ul></div>')
    pre = '<main id="out">' + ''.join(out) + '</main>'
    s = re.sub(r'<main id="out">.*?</main>', lambda m: pre, s, count=1, flags=re.S)

    # ---------------------------------------------------------- data + keys
    data_js = 'const D=' + json.dumps(parks, ensure_ascii=False, separators=(',', ':')) + ';'
    s = re.sub(r'const D=\[.*?\n\];', lambda m: data_js, s, count=1, flags=re.S)
    # Renaming the storage key would orphan saved checkmarks, so a season that
    # was previously published under another key carries it and migrates once.
    legacy = season.get('legacyKey')
    migrate = ''
    if legacy:
        migrate = (
            f"\nconst LEGACY={json.dumps(legacy)};\n"
            "try{ if(localStorage.getItem(LEGACY)&&!localStorage.getItem(KEY)){\n"
            "  localStorage.setItem(KEY,localStorage.getItem(LEGACY));\n"
            "  const lw=localStorage.getItem(LEGACY+'-want');\n"
            "  if(lw&&!localStorage.getItem(WKEY))localStorage.setItem(WKEY,lw);\n"
            "} }catch(e){}")
    s = sub1(s, "const KEY='dlr-halloween-2026', WKEY=KEY+'-want';",
             f"const SEASON={json.dumps({'title': season['title'], 'year': season['year'], 'slug': season['slug']}, ensure_ascii=False)};\n"
             f"const KEY='treats:{season['slug']}', WKEY=KEY+'-want';{migrate}",
             'storage keys')

    # season strings baked into the share and PDF code
    jsfix = [
        ("navigator.share({title:'Halloween Time Treats',text:label,url})",
         "navigator.share({title:SEASON.title,text:label,url})", 'share link title'),
        ("T('Halloween Time Treats \\u2014 My List',it.x,it.y,16,true);",
         "T(SEASON.title+' \\u2014 My List',it.x,it.y,16,true);", 'pdf title'),
        ("T('Halloween Time 2026 \\u00b7 my list',PG.m,PG.m-2,7.3,false,.55);",
         "T(opt.foot||(SEASON.title+' '+SEASON.year+' \\u00b7 my list'),"
         "PG.m,PG.m-2,7.3,false,.55);",
         'pdf footer'),
        ("const inf=add('<< /Title (Halloween Time Treats \\\\055 My List) "
         "/Creator (Halloween Time Treat Guide) >>');",
         "const inf=add('<< /Title ('+pstr(SEASON.title+' - My List').slice(1,-1)+') "
         "/Creator (Disneyland Resort treat guide) >>');", 'pdf metadata'),
        ("return 'halloween-time-my-list-'+n+'-treat'+(n===1?'':'s')+'.pdf';",
         "return SEASON.slug+'-my-list-'+n+'-treat'+(n===1?'':'s')+'.pdf';", 'pdf filename'),
        ("navigator.share({files:[f],title:'Halloween Time — My List'})",
         "navigator.share({files:[f],title:SEASON.title+' — My List'})", 'pdf share title'),
    ]
    for old, new, label in jsfix:
        s = sub1(s, old, new, label)

    # ------------------------------------------------- season-agnostic filters
    # The shell hard-coded Halloween's tag names. Drive filtering from the
    # season's own chip list instead: category chips are OR'd together, every
    # other tag chip is AND'd, and todo/want/viewing stay computed.
    cat_tags = [c['f'] for c in season['chips'] if c['f'] in ('food', 'drink', 'booze', 'novelty')]
    tag_chips = [c['f'] for c in season['chips']
                 if c['f'] not in ('todo', 'want') and c['f'] not in cat_tags]
    # --------------------------------------------- one PDF generator, three uses
    # wishRows/wishPDF were hard-wired to the wishlist. Give them a predicate
    # and options so the same layout code renders the full guide and the
    # highlights too, in the browser and under Node at build time.
    s = sub1(s, 'function wishRows(){',
             'function wishRows(pick,opt){\n  pick=pick||((sp,it)=>want.has(sp.n+\'|\'+it.n));\n  opt=opt||{};',
             'wishRows signature')
    s = sub1(s, '        const hits=sp.i.filter(it=>want.has(sp.n+\'|\'+it.n));',
             '        const hits=sp.i.filter(it=>pick(sp,it));',
             'wishRows predicate')
    s = sub1(s, 'function wishPDF(){\n  const rows=wishRows();',
             'function wishPDF(pick,opt){\n  opt=opt||{};\n  const rows=wishRows(pick,opt);',
             'wishPDF signature')
    s = sub1(s, """  const n=want.size;
  const sub='Disneyland Resort \\u00b7 '+n+' treat'+(n===1?'':'s')+' to try';""",
             """  const n=rows.filter(r=>r.k==='item'&&!r.cont).length;
  const sub=opt.sub||('Disneyland Resort \\u00b7 '+n+' treat'+(n===1?'':'s')+' to try');""",
             'wishPDF subtitle')
    s = sub1(s, "        T(SEASON.title+' \\u2014 My List',it.x,it.y,16,true);",
             "        T(opt.heading||(SEASON.title+' \\u2014 My List'),it.x,it.y,16,true);",
             'wishPDF heading')
    # expose for the build script when running under Node
    s = sub1(s, "const printOut=document.getElementById('printout');"
             if "const printOut=document.getElementById('printout');" in s
             else "function pdfName(){",
             ("if(typeof module!=='undefined'&&module.exports){"
              "module.exports={wishPDF,wishRows,D,SEASON};}\n\nfunction pdfName(){"),
             'node export')

    # style the PDF buttons like the links they replace
    s = sub1(s, '  .files a{',
             '  .files button.pdfbtn{\n'
             '    flex:0 0 auto;font:inherit;font-size:.76rem;color:var(--ink);\n'
             '    background:var(--card);border:1px solid var(--rule);border-radius:99px;\n'
             '    padding:.3rem .62rem;white-space:nowrap;cursor:pointer;\n'
             '  }\n'
             '  .files button.pdfbtn:active{background:var(--ink);color:var(--paper)}\n'
             '  .files a{', 'pdf button css')

    # wire them to the shared generator
    s = sub1(s, "document.getElementById('reset').addEventListener('click',()=>{",
             """function downloadPDF(bytes,name){
  const file=new Blob([bytes],{type:'application/pdf'});
  try{
    const url=URL.createObjectURL(file);
    const a=document.createElement('a');
    a.href=url; a.download=name; a.rel='noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),8000);
    toast('PDF saved');
  }catch(e){ toast('Could not save the PDF'); }
}
function fullPDF(pick,label,heading,sub){
  let bytes;
  try{
    const foot=SEASON.title+' '+SEASON.year+' \\u00b7 '+label;
    bytes=wishPDF(pick,{heading,sub,foot});
  }catch(e){ toast('Could not build the PDF'); return; }
  downloadPDF(bytes,SEASON.slug+'-'+label+'.pdf');
}
document.getElementById('pdf-all').addEventListener('click',()=>{
  fullPDF(()=>true,'everything',SEASON.title+' '+SEASON.year,
    'Disneyland Resort \\u00b7 every seasonal item, by park and land \\u00b7 '+total+' items');
});
document.getElementById('pdf-new').addEventListener('click',()=>{
  const n=IDX.length&&0; let c=0;
  for(const p of D)for(const L of p.L)for(const s of L.s)for(const it of s.i)
    if(it.t.includes('new'))c++;
  fullPDF((sp,it)=>it.t.includes('new'),'new-this-year',
    SEASON.title+' '+SEASON.year+' \\u2014 New this year',
    'Disneyland Resort \\u00b7 items new for this season \\u00b7 '+c+' items');
});

document.getElementById('reset').addEventListener('click',()=>{""",
             'pdf buttons wiring')

    old_match = """  if(active.has('new')&&!it.t.includes('new'))return false;
  if(active.has('gone')&&it.e!=='Oct 31')return false;
  const types=['food','drink','booze'].filter(t=>active.has(t));
  if(types.length&&!types.some(t=>it.t.includes(t)))return false;"""
    new_match = (
        f'  const TAGS={json.dumps(tag_chips)}, CATS={json.dumps(cat_tags)};\n'
        '  for(const t of TAGS){ if(active.has(t)&&!it.t.includes(t))return false; }\n'
        '  const types=CATS.filter(t=>active.has(t));\n'
        '  if(types.length&&!types.some(t=>it.t.includes(t)))return false;')
    s = sub1(s, old_match, new_match, 'filter logic')

    # ---------------------------------------------------------- footer source
    s = re.sub(r'  <p>Compiled from .*?</p>',
               f'  <p>Compiled from {esc(season["source"])}.</p>', s, count=1, flags=re.S)
    s = re.sub(r'<title>.*?</title>',
               f'<title>{esc(season["title"])} {season["year"]} — Disneyland Resort</title>',
               s, count=1, flags=re.S)

    io.open(out_path, 'w', encoding='utf-8').write(s)
    n = sum(len(sp['i']) for p in parks for L in p['L'] for sp in L['s'])
    print(f'built {out_path}: {len(s):,} chars, {n} items')
    return s

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
