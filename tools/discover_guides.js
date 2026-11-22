/* Find new Disneyland foodie guides, and tell which season a guide belongs to.

   Disney publishes one guide per recurring event per year. Since 2026 its
   addresses carry no year (…/foodie-guide-to-halloween-at-disneyland-resort/),
   so next year's guide may be the same page republished. A season is therefore
   identified by event + the year the page was published, never by URL alone:
   the same URL republished in a new year is a new season, and the old one is
   archived untouched.

   Used by check_guides.js; this file does no writing itself. */

// Recurring events tracked as seasons. Anything else Disney posts (Dole Whip
// Day, Pride Nite, one-off roundups) is ignored. Order matters: first match.
const EVENTS = [
  { event: 'lunar-new-year', re: /lunar-new-year/ },
  { event: 'food-and-wine', re: /food-(and-)?wine/ },
  { event: 'season-of-the-force', re: /season-of-the-force/ },
  { event: 'halloween', re: /halloween/ },
  { event: 'holiday', re: /holiday|christmas/ },   // includes Festival of Holidays
];

// Where new guides show up. Both list foodie-guide posts newest first.
const INDEX_PAGES = [
  'https://disneyparksblog.com/tag/foodie-guide/',
  'https://disneyparksblog.com/blog/topics/foodie-guides/',
];

/* Event for a guide URL, or null. Only food posts count: Disney links
   non-food Halloween and holiday news from the same pages. */
function classify(url) {
  const slug = url.replace(/\/+$/, '').split('/').pop();
  if (!/(foodie|disney-eats)/.test(slug)) return null;
  const hit = EVENTS.find(e => e.re.test(slug));
  return hit ? hit.event : null;
}

/* Disneyland guide URLs linked from an index page. */
function guideLinks(html) {
  const urls = html.match(/https:\/\/disneyparksblog\.com\/dlr\/[a-z0-9-]+\//g) || [];
  return [...new Set(urls)].filter(classify);
}

/* Published time and title from a post's own metadata. */
function pageMeta(html) {
  const pub = (html.match(/article:published_time" content="([^"]+)"/) || [])[1] || null;
  const title = (html.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || null;
  return { published: pub, title };
}

/* Season slug for an event published at an ISO time, e.g. holiday-2026.
   Lunar New Year falls in Jan/Feb; a guide posted in December is for the
   following year's festival. */
function seasonSlug(event, published) {
  if (!event || !published) return null;
  const p = new Date(published);
  const fmt = o => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', ...o }).format(p));
  let year = fmt({ year: 'numeric' });
  if (event === 'lunar-new-year' && fmt({ month: 'numeric' }) === 12) year++;
  return `${event}-${year}`;
}

/* Season for a guide: an existing season of that event whose run covers the
   publish date (or starts within six months of it) wins, so Disney re-dating
   a guide mid-season never spawns a duplicate. Otherwise event + year.
   runsBySlug: { 'holiday-2026': { start, end }, ... } from seasons/. */
function seasonFor(event, published, runsBySlug) {
  if (!event || !published) return null;
  const p = new Date(published);
  for (const [slug, r] of Object.entries(runsBySlug)) {
    if (!slug.startsWith(event + '-') || !/^\d{4}$/.test(slug.slice(event.length + 1))) continue;
    const start = new Date(r.start + 'T00:00:00-08:00'), end = new Date(r.end + 'T23:59:59-08:00');
    if (p <= end && (start - p) / 864e5 <= 183) return slug;
  }
  return seasonSlug(event, published);
}

/* Guide id for the watch list: the URL's own slug, shortened, plus the season
   year, so the same URL in two years gets two ids. */
function guideId(url, season) {
  const slug = url.replace(/\/+$/, '').split('/').pop()
    .replace(/^disney-eats-/, '').replace(/^foodie-guide-to-/, '')
    .replace(/-at-(the-)?disneyland-resort$/, '').replace(/-\d{4}$/, '');
  return `${slug}-${season.split('-').pop()}`;
}

/* The article body: from Disney's entry-content block to the start of the
   related-posts block after it. That block's shape varies by page (a posts
   carousel, a three-card row), but it always holds the first READ MORE
   button, so cut at the Disney block that contains it. Used for guides
   without hand-picked anchors (every discovered one). Returns null if the
   page layout has changed, which the caller reports as a failure. */
function articleBody(html) {
  const s = html.indexOf('class="entry-content');
  if (s === -1) return null;
  const start = html.indexOf('>', s) + 1;
  const more = html.indexOf('READ MORE', start);
  if (more === -1) return null;
  const block = html.lastIndexOf('class="wp-block-aloha-', more);
  if (block < start) return null;
  const end = html.lastIndexOf('<', block);
  return end > start ? html.slice(start, end) : null;
}

module.exports = { EVENTS, INDEX_PAGES, classify, guideLinks, pageMeta, seasonSlug, seasonFor, guideId, articleBody };
