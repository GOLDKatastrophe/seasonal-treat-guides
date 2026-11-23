#!/usr/bin/env python3
"""Write dist/sitemap.xml and dist/robots.txt so search engines find every
season page. Runs as part of `make`; a new season is included automatically.

    python3 tools/make_sitemap.py seasons/*.json dist/
"""
import json, os, sys, datetime
import og

def build(season_files, out_dir, today=None):
    today = today or datetime.date.today()
    site = og.site_url()
    pages = [('', 'weekly', '1.0')]
    for f in sorted(season_files):
        s = json.load(open(f, encoding='utf-8'))
        end = datetime.date.fromisoformat(s['runs']['end'])
        # running or upcoming seasons change as Disney edits its guide;
        # ended ones are an archive
        pages.append((f'{s["slug"]}/', 'daily' if end >= today else 'yearly',
                      '0.9' if end >= today else '0.5'))
    urls = '\n'.join(
        f'  <url><loc>{site}/{p}</loc><changefreq>{c}</changefreq><priority>{pr}</priority></url>'
        for p, c, pr in pages)
    with open(os.path.join(out_dir, 'sitemap.xml'), 'w', encoding='utf-8') as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                 f'{urls}\n</urlset>\n')
    with open(os.path.join(out_dir, 'robots.txt'), 'w', encoding='utf-8') as fh:
        fh.write(f'User-agent: *\nAllow: /\n\nSitemap: {site}/sitemap.xml\n')
    print(f'built sitemap.xml: {len(pages)} pages')

if __name__ == '__main__':
    build(sys.argv[1:-1], sys.argv[-1])
