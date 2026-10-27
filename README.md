# Dash My Plugins

A compact desktop working board for Meow Apps: release reminders, download
direction, and support. Uses the existing Next.js 13 Pages Router app and WordPress.org APIs.

```sh
pnpm install
pnpm dev
pnpm build
node --test tests/*.test.mjs
```

Configure `PLUGINS` (comma-separated slugs) and `SITE_NAME` in `.env`.
Development uses `.next-dev`; production builds use `.next`, so building does not
invalidate an open preview.

## Working board

- The single-screen desktop grid puts cards immediately below a 54-pixel header.
  Every card shows release age, open threads (including zero), downloads vs.
  last year, and the quiet download floor for the last 12 months. Release reminders
  have a large amber warning badge; overdue reminders use coral.
- Blue cards have actions or missing data to review; green cards have no action
  flagged.  Attention items sort first.
- Release reminders warn at **32 days**, and become overdue at **64 days**.
  Overrides are saved in the current browser. The shared defaults apply on other
  machines without configuration.
- Release dates come from dated changelog entries for the current published
  version. Metadata last-updated is a fallback, not an invented release history.
- Open a card for the trend explained, support, and the raw 30/90/365-day history.
- There are no filters, search field, hero heading, or CSV controls.

## Download trend

The card answers one question: is a plugin doing better or worse than a year ago?

1. The last 728 complete UTC days are split into 26 blocks of 28 days. Each block
   holds exactly four of every weekday, so the weekday mix cannot move it.
2. A block's **quiet floor** is the 25th percentile of its daily downloads: the
   level between release spikes. A block needs 24 known days, or it stays unknown.
   No release dates are used, because WordPress.org truncates long changelogs
   (AI Engine's only reaches back a few months).
3. **Vs. last year** pairs each of the last 13 blocks with the same block a year
   earlier, so seasons line up, and takes the median change (on log(x+1)). One
   unusual month cannot decide it. At least six pairs are required.
4. The last three pairs (12 weeks) must agree: **Growing** needs at least +10% and
   a positive recent change, **Declining** at most −10% and a negative one.
   **Steady** is within 10% with the recent change within 20%. Anything else is
   **Mixed**. A median floor below 5/day reads **Low volume**.
5. **Vs. others** is the difference with the median of all readable plugins. When
   everything grows together it is the season or WordPress.org, not the plugin.

Only Declining adds an action. Downloads include updates, so a very different
release pace from last year can still move the floor. This is a robust heuristic,
not a count of new users or a causal model.

The card chart draws the floor of each block of the last year (solid) over the
same blocks a year earlier (dashed). The detail view keeps the raw history.

## Data and cache

- HTTPS requests have a 15-second deadline and one retry; requests are batched
  across four plugins. Public changelogs are parsed for dates, not rendered.
- Complete snapshots have a 15-minute server cache with in-flight deduplication.
  ISR revalidates after 15 minutes. Refresh respects the same cache.
- The last complete snapshot is saved atomically under `.cache/` (gitignored).
  `DASH_CACHE_DIR` can point at persistent storage in a container deployment.
  Without a mounted volume it survives process restarts but not container replacement.
- Partial/failed upstream responses never overwrite the last good snapshot. It
  is served with a stale warning and its original timestamp. Failed upstream
  refreshes have a 60-second retry cooldown. Read-only filesystems retain the
  in-memory cache. First-run failure with no usable snapshot returns an error.
- Only the last 730 daily counts and parsed metadata are serialized to clients.
- Installs are rounded bands and may overlap across plugins; support counts are
  unresolved WordPress.org topics in the reporting window, not necessarily unanswered.

Sources: [WordPress plugin information API](https://codex.wordpress.org/WordPress.org_API#Plugins),
[download statistics API](https://api.wordpress.org/stats/plugin/1.0/downloads.php?slug=ai-engine&limit=84),
[AI Engine published changelog](https://wordpress.org/plugins/ai-engine/#developers).

## Checks

```sh
node --test tests/*.test.mjs
pnpm lint
pnpm build
```

Coverage includes stable, growing and falling demand; repeated seasons; release
spikes, isolated zeros and an unusual month; a recent turn after a good year;
short history and low volume; the portfolio median; release threshold boundaries;
UTC windows and aggregation; concurrent cache requests, restart persistence,
stale fallback, retry cooldown and recovery.

No deployment is performed by development or verification commands.
