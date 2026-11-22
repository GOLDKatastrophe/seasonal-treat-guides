A watched Disney foodie guide has changed. The normalised text of each guide
lives in `data/guides/`, and the git diff of those files appears at the end of
this prompt. That diff is the authoritative statement of what Disney changed.

Read `CLAUDE.md` first, then update the matching `seasons/*.json` so the season
data reflects Disney's current guide.

Follow `CLAUDE.md` exactly. In particular:

- Make the smallest edit that matches the diff. Do not reformat, reorder or
  rewrite untouched entries.
- Remove items that have disappeared from Disney's guide.
- Treat a rename as an edit to that entry, not a delete plus an add.
- Keep item names, locations and dates verbatim from Disney.
- If a whole new season's guide has appeared, create a new `seasons/<slug>.json`
  rather than extending an existing season.

Then run `make check` and fix anything it reports. Never edit `dist/`.

Finally, write `CHANGES.md` at the repo root: a short plain-English summary,
one bullet per item added, removed, renamed or re-described, each naming its
location. If the diff turned out to be cosmetic and you changed no season data,
say exactly that in `CHANGES.md` and change nothing else.

The diff follows.
