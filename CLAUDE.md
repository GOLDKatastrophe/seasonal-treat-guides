# Working in this repo

Seasonal Disneyland treat checklists. One app shell, one JSON file per season.

## The rule that matters

**Never hand-edit anything in `dist/`.** It is generated and gitignored.
Change `seasons/*.json` or `tools/`, then run `make`.

Always run `make check` before committing. It fails on malformed data,
missing end dates, duplicate item keys, and colour pairings below 4.5:1.

## Season data

`seasons/<slug>.json`:

    slug, title, year, subtitle, source
    runs: { start, end }          ISO dates; drives the landing page badge
    theme: 9 colour tokens        paper card ink soft rule accent accent2 done want warn
    chips: [{ f, label }]         filter buttons
    legacyKey (optional)          previous localStorage key, migrated once
    parks: [{ p, L: [{ l, s: [{ n, m?, i: [item] }] }] }]

An item is `{ n, d?, t: [tags], e, b? }` — name, description, tags, end date
(short form like `"Jan 6"`), optional begin date.

Every item carries **exactly one** category tag: `food`, `drink`, `booze` or
`novelty`. Other tags are optional: `new`, `short` (a run narrower than the
season), `gone` (Halloween's "gone after Oct 31").

Chips are data-driven. Category chips are OR'd together; every other tag chip
is AND'd. A chip whose tag no entry carries will silently match nothing, so
add the tag to items in the same change.

## Updating a season from Disney's guide

`tools/check_guides.js` fetches each watched guide, normalises it to plain
text and commits the result to `data/guides/<id>.txt`. The git diff of that
file is the authoritative statement of what Disney changed.

When updating season data from such a diff:

- **Make the smallest edit that matches the diff.** Change the lines that
  changed. Do not reformat, reorder or rewrite untouched entries — a large
  diff is impossible to review and defeats the point.
- Item names, locations and dates come from Disney verbatim. They are facts.
- **Descriptions are Disney's wording, kept as written.** This was a deliberate
  decision, not an oversight: do not paraphrase, shorten or restyle them. The
  only edits to make are structural, and only where Disney's own markup is
  broken:
    - split an entry where the item name runs into its description, and
      capitalise the resulting description fragment
    - move an availability trailer such as `(Available Nov. 13 through Jan. 6,
      2027)` out of the prose and into the `b` / `e` date fields
    - close unmatched parentheses and drop Disney's duplicated trailers
  If a description reads oddly but is intact, leave it alone.
- **The site is also an archive.** Each season file is the record of what that
  season offered, and stays published after the season ends. So an item that
  disappears from Disney's guide is usually **kept**, not deleted:
    - Its end date has passed: Disney is just tidying up. Leave it untouched.
    - It disappears before its end date, after it went on sale: it was pulled
      early. Keep it, and move `e` back to the last date the guide listed it.
    - It disappears before it ever went on sale (`b`, or the season start, is
      still in the future): it never ran. Remove it.
  The same applies to a location and its items. Keeping items also keeps
  share links working: removing one changes the fingerprint and rejects
  every list shared before the edit.
- An item that is renamed is an edit to that entry, not a delete plus an add.
  Renaming changes the share-link fingerprint either way, which is expected
  and handled — old links are rejected with an explanation rather than
  resolving to the wrong treat.
- A guide for a season with no file yet means a new season: see below.
  Never extend an existing season with another year's or event's items.

## Starting a new season

`tools/check_guides.js` discovers new Disneyland guides for the recurring
events listed in `tools/discover_guides.js` (Lunar New Year, Food & Wine,
Season of the Force, Halloween, Holidays) and adds each to `data/guides.json`
with the season it belongs to, e.g. `lunar-new-year-2027`. One file per event
per year; a second guide for the same season (Festival of Holidays alongside
the Holidays guide) adds to that season's file rather than making another.

When a guide's `season` has no `seasons/<season>.json` yet, create it:

- **Read the whole guide** in `data/guides/<id>.txt`. The diff in your prompt
  is truncated; the file is not.
- **Structure:** copy `seasons/holiday-2026.json`'s shape. `slug` is the
  season name exactly; `title` is short and names the event ("Lunar New Year
  Treats", "Food & Wine Festival Treats"); `year` is the slug's year;
  `subtitle` is "Disneyland Resort · <first day> – <last day>"; `source` names
  the guide(s) and their publish date; no `legacyKey`.
- **`runs`:** the event's first and last day as Disney states them, as ISO
  dates.
- **Items:** every food and drink item, under the park, land and location
  Disney gives, with Disney's names and descriptions as written (the rules
  above apply). Exactly one category tag each; `new` where Disney says New;
  `short` where an item's run is narrower than the season. Every item needs
  `e`, and `b` when it starts after the season does.
- **Skip merchandise.** Buckets, sippers, tumblers, straw clips and glow cubes
  are out of scope for new seasons, even when Disney lists them.
- **Chips:** the holiday season's set, minus any whose tag no item carries.
- **Palette:** nine colours that suit the event and differ from the other
  seasons. `make check` enforces 4.5:1 contrast on every pairing.
- Then `make previews` to draw its link-preview card, and `make check`.

## What not to change without being asked

- `tools/shell.html` — the app shell. Editing it affects every season.
- Storage keys and the share-link fingerprint scheme.
- The PDF generator's layout code.

## Build

    make          build dist/
    make check    build, then run tools/check_build.js
    make previews redraw the link-preview cards in previews/ (needs Chrome)
    make clean

`make check` fails when a preview card no longer matches its season's title,
dates or palette; `make previews` fixes it. The cards carry no domain name: the
site address is set once, as `SITE_URL` in the Makefile.

Python 3 and Node 20. No dependencies.
