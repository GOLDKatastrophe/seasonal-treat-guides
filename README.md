# Disneyland Resort seasonal treat guides

An unofficial fan project. Not affiliated with, endorsed by, or sponsored by
The Walt Disney Company.

Built with [Claude Code](https://claude.com/claude-code). It also drafts the
season-data updates when Disney changes a guide; each one arrives as a pull
request for review.

Live: https://treats.kylejgold.com

## Layout

    seasons/<slug>.json    season data: items, theme, chips, run dates
    tools/shell.html       the app shell — HTML, CSS, JS; no season in it
    tools/build.py         season JSON -> dist/<slug>/index.html
    tools/render_pdfs.js   runs the page's own PDF generator under Node
    tools/make_index.py    all seasons -> dist/index.html
    tools/check_build.js   post-build checks; CI fails on these
    tools/render_previews.js  link-preview cards -> previews/*.png (needs Chrome)
    previews/              committed 1200x630 og:image cards, one per page
    tools/check_guides.js  daily: discover new Disney guides, fingerprint watched ones
    tools/discover_guides.js  which events are seasons; guide -> season matching
    data/guides.json       watched guides and the season each belongs to
    data/guide-index.json  every Disney guide seen, so old ones aren't re-added
    data/guides/<id>.txt   each guide's normalised text; its diff is the change
    dist/                  build output, deployed to Cloudflare (gitignored)

## Build

    make          # build everything into dist/
    make check    # build, then run the checks
    make previews # redraw the link-preview cards (needs Chrome)
    make clean

Needs Python 3 and Node 20. No dependencies to install.

## Adding a season

Drop `seasons/<slug>.json` in and run `make`. No HTML is edited and no
build file changes.

A season carries:

- `theme` — nine colour tokens. `make check` fails the build if any pairing
  falls below 4.5:1 contrast, so a new palette can't ship unreadable.
- `chips` — the filter buttons. Category chips (food/drink/booze/novelty)
  are OR'd together; every other tag chip is AND'd. Driven entirely by the
  tags present in the items.
- `runs` — start and end dates, which decide what the landing page marks as
  running now.
- `legacyKey` — optional. A season previously published under a different
  localStorage key sets this and migrates saved stars once on first load.

## PDFs

There is one PDF generator, in the page. It takes a predicate, so the same
layout code produces the wishlist in the browser and the `everything.pdf`
and `highlights.pdf` downloads. `tools/render_pdfs.js` runs that same code
under Node at build time, so the static downloads cannot drift from what
the page shows.

## Saved state

Stars and checkmarks live in `localStorage` under `treats:<slug>`, so an
item appearing in two seasons is tracked separately in each. Nothing is
sent anywhere; there are no accounts and no analytics.

Share links encode the wishlist as a bitfield plus a fingerprint of the
item order. Editing a season's data changes the fingerprint, so links made
before the edit are rejected with an explanation instead of silently
starring the wrong items.

## Automatic updates

`.github/workflows/check-guides.yml` runs weekday evenings. It looks for new
Disneyland foodie guides for the recurring events (Lunar New Year, Food &
Wine, Season of the Force, Halloween, Holidays) and checks every watched guide
for changes. When something is new or changed, Claude Code edits the season,
or drafts a whole new `seasons/<event>-<year>.json`, and opens a pull request.
Nothing reaches the site until it's merged. A season stops being watched two
weeks after it ends and stays published as an archive.

## Deploying

CI builds on every push and pull request, and deploys `dist/` to Cloudflare
only from `main`.

    Repo:   GOLDKatastrophe/seasonal-treat-guides
    Worker: treats
    Domain: treats.kylejgold.com

Two repository secrets are needed:

- `CLOUDFLARE_API_TOKEN` — scoped to Workers Scripts: Edit
- `CLOUDFLARE_ACCOUNT_ID`

To deploy by hand instead: `make && npx wrangler deploy`.

The guide check (`check-guides.yml`, weekday evenings) needs a third secret,
`CLAUDE_CODE_OAUTH_TOKEN`, made with `claude setup-token`. It expires a
year after it's made; when it does, the update step fails until it's
replaced.

## Sources

Compiled from Disney's official Disney Eats foodie guides. Item names,
locations and dates are facts taken from those guides.
