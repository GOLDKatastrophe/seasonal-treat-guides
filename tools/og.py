"""Link-preview tags (Open Graph + Twitter card) shared by build.py and
make_index.py. Social sites need absolute URLs, so the site's address comes
from SITE_URL, which the Makefile sets in one place."""
import html, os, sys

SITE_NAME = 'Disneyland Resort Seasonal Treat Guides'

def site_url():
    u = os.environ.get('SITE_URL', '').rstrip('/')
    if not u.startswith('https://'):
        sys.exit("SITE_URL must be the site's https:// address; run the build through make, which sets it")
    return u

def tags(title, description, path, alt):
    """path is the page's directory relative to the site root: '' or 'holiday-2026/'."""
    e = lambda t: html.escape(str(t), quote=True)
    page = f'{site_url()}/{path}'
    return '\n'.join([
        f'<link rel="canonical" href="{e(page)}">',
        f'<meta name="description" content="{e(description)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{e(SITE_NAME)}">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(description)}">',
        f'<meta property="og:url" content="{e(page)}">',
        f'<meta property="og:image" content="{e(page)}preview.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{e(alt)}">',
        '<meta name="twitter:card" content="summary_large_image">',
    ])
