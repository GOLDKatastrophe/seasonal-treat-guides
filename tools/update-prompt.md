A Disney foodie guide is new or has changed. The normalised text of each guide
lives in `data/guides/`, and the git diff of those files appears at the end of
this prompt (cut off at 60 KB; the files themselves are complete). That diff is
the authoritative statement of what Disney changed.

Read `CLAUDE.md` first. `data/guides.json` says which season each guide belongs
to. Then, for each guide in the diff:

- If its season's file exists, update that `seasons/*.json` so it reflects
  Disney's current guide.
- If its season has no file yet, create the new season, following "Starting a
  new season" in `CLAUDE.md`, from the complete text in `data/guides/<id>.txt`.

Follow `CLAUDE.md` exactly. In particular:

- Make the smallest edit that matches the diff. Do not reformat, reorder or
  rewrite untouched entries.
- Do not delete an item just because it disappeared from Disney's guide: the
  site is an archive. Follow the rules in `CLAUDE.md` for whether to leave it,
  shorten its end date, or (only if it never went on sale) remove it.
- Treat a rename as an edit to that entry, not a delete plus an add.
- Keep item names, locations and dates verbatim from Disney.
- Never put one season's items into another season's file.

Then run `make check` and fix anything it reports. Never edit `dist/`.

Finally, write `CHANGES.md` at the repo root: a short plain-English summary.
For a new season, give its dates, its item count per park, its palette, and
any judgement calls (items you skipped as merchandise, dates you inferred).
For an existing season, one bullet per item added, removed, pulled early,
renamed or re-described, each naming its location. List items that left Disney's guide after their end
date under a separate "Kept (ended)" heading so the reviewer can see they were
considered. If the diff turned out to be cosmetic and you changed no season data,
say exactly that in `CHANGES.md` and change nothing else.

The diff follows.
