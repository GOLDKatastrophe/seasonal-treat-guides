#!/usr/bin/env python3
"""Build the root landing page listing every season, current one first."""
import io, json, html, sys, datetime

def esc(t): return html.escape(str(t), quote=True)

def build(season_files, out_path, today=None):
    today = today or datetime.date.today()
    seasons = []
    for f in season_files:
        s = json.load(open(f, encoding='utf-8'))
        n = sum(len(sp['i']) for p in s['parks'] for L in p['L'] for sp in L['s'])
        start = datetime.date.fromisoformat(s['runs']['start'])
        end = datetime.date.fromisoformat(s['runs']['end'])
        seasons.append({**s, 'count': n, 'start': start, 'end': end,
                        'live': start <= today <= end})
    seasons.sort(key=lambda s: (not s['live'], -s['start'].toordinal()))

    cards = []
    for s in seasons:
        th = s['theme']
        status = 'Running now' if s['live'] else (
            'Starts ' + s['start'].strftime('%b %-d') if s['start'] > today
            else 'Ended ' + s['end'].strftime('%b %-d, %Y'))
        cards.append(f'''    <a class="season{' live' if s['live'] else ''}" href="{esc(s['slug'])}/"
       style="--sa:{th['accent']};--sc:{th['card']};--sp:{th['paper']}">
      <span class="badge">{esc(status)}</span>
      <h2>{esc(s['title'])} {s['year']}</h2>
      <p>{esc(s['count'])} items &middot; {esc(s['start'].strftime('%b %-d'))} &ndash; {esc(s['end'].strftime('%b %-d, %Y'))}</p>
    </a>''')

    page = f'''<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Disneyland Resort Seasonal Treat Guides</title>
<meta name="description" content="Checklists of every seasonal food and drink item at the Disneyland Resort, by park and land.">
<style>
  :root{{
    --paper:#14141A; --card:#1F1F29; --ink:#F2EFE6; --soft:#A7A3B5; --rule:#343243;
  }}
  *{{box-sizing:border-box}}
  body{{
    margin:0; padding:2rem 1rem 3rem; background:var(--paper); color:var(--ink);
    font:16px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;
    -webkit-text-size-adjust:100%;
  }}
  .wrap{{max-width:38rem;margin:0 auto}}
  header{{margin:0 0 1.6rem}}
  h1{{font:600 1.6rem/1.2 Georgia,"Iowan Old Style",serif;margin:0 0 .35rem}}
  header p{{margin:0;color:var(--soft);font-size:.92rem}}
  .season{{
    display:block;text-decoration:none;color:inherit;margin:0 0 .8rem;
    padding:1rem 1.1rem;border-radius:12px;border:1px solid var(--rule);
    background:var(--sc,var(--card));position:relative;
  }}
  .season.live{{border-color:var(--sa);box-shadow:inset 3px 0 0 var(--sa)}}
  .season:active{{transform:scale(.995)}}
  .season h2{{font:600 1.08rem/1.3 Georgia,serif;margin:.3rem 0 .2rem}}
  .season p{{margin:0;color:var(--soft);font-size:.86rem}}
  .badge{{
    display:inline-block;font-size:.68rem;letter-spacing:.04em;text-transform:uppercase;
    color:var(--sa,var(--soft));font-weight:700;
  }}
  footer{{margin:2rem 0 0;color:var(--soft);font-size:.78rem;line-height:1.55}}
  footer p{{margin:0 0 .5rem}}
  @media (prefers-color-scheme:light){{
    :root:not([data-theme="dark"]){{--paper:#F7F5F0;--ink:#1A1822;--soft:#5C5869;--rule:#D9D4CB}}
  }}
</style>
<div class="wrap">
  <header>
    <h1>Disneyland Resort Treat Guides</h1>
    <p>Every seasonal food and drink item, by park and land. Tap a star to build a list, tick things off as you go.</p>
  </header>
{chr(10).join(cards)}
  <footer>
    <p>End dates are the last day each item is scheduled to be sold. Menus and prices change
       without notice &mdash; confirm in the Disneyland app.</p>
    <p>An unofficial fan project. Not affiliated with, endorsed by, or sponsored by
       The Walt Disney Company.</p>
  </footer>
</div>
</html>
'''
    io.open(out_path, 'w', encoding='utf-8').write(page)
    print(f'built {out_path}: {len(seasons)} seasons, {len(page):,} chars')
    for s in seasons:
        print(f"  {'* ' if s['live'] else '  '}{s['slug']}: {s['count']} items")

if __name__ == '__main__':
    build(sys.argv[1:-1], sys.argv[-1])
