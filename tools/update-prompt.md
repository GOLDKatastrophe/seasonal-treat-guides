A watched Disney foodie guide has changed. The normalised text of each guide
lives in `data/guides/`, and the git diff of those files appears at the end of
this prompt. That diff is the authoritative statement of what Disney changed.

Read `CLAUDE.md` first, then update the matching `seasons/*.json` so the season
data reflects Disney's current guide.

Follow `CLAUDE.md` exactly. In particular:

- Make the smallest edit that matches the diff. Do not reformat, reorder or
  rewrite untouched entries.
- Do not delete an item just because it disappeared from Disney's guide: the
  site is an archive. Follow the rules in `CLAUDE.md` for whether to leave it,
  shorten its end date, or (only if it never went on sale) remove it.
- Treat a rename as an edit to that entry, not a delete plus an add.
- Keep item names, locations and dates verbatim from Disney.
- If a whole new season's guide has appeared, create a new `seasons/<slug>.json`
  rather than extending an existing season.

Then run `make check` and fix anything it reports. Never edit `dist/`.

Finally, write `CHANGES.md` at the repo root: a short plain-English summary,
one bullet per item added, removed, pulled early, renamed or re-described,
each naming its location. List items that left Disney's guide after their end
date under a separate "Kept (ended)" heading so the reviewer can see they were
considered. If the diff turned out to be cosmetic and you changed no season data,
say exactly that in `CHANGES.md` and change nothing else.

The diff follows.
