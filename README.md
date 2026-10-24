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
  Every card shows release age, open threads (including zero), download direction,
  and twelve weeks of download bars with a quieter trend line. Release reminders
  have a large amber warning badge; overdue reminders use coral.
- Blue cards have actions or missing data to review; green cards have no action
  flagged. Green is not a claim of download growth. Attention items sort first.
- Release reminders warn at **32 days**, and become overdue at **64 days**.
  Overrides are saved in the current browser. The shared defaults apply on other
  machines without configuration.
- Release dates come from dated changelog entries for the current published
  version. Metadata last-updated is a fallback, not an invented release history.
- Open a card for comparison coverage, release markers, support, and the complete
  uncapped 30/90/365-day download history.
- There are no filters, search field, hero heading, or CSV controls.

## Download comparison

Download totals mix installs and updates. A slower release schedule can lower
both peaks and their multi-day tails without indicating lower underlying demand.
The former trimmed-week baseline did not control for this and was too confident.

The card's **Quiet downloads** reading is descriptive. It says **Higher**, **Steady**,
**Lower**, or **Uneven**, and shows the usual lower daily level. It compares two
adjacent 42-day UTC periods, excludes days 0–3 after releases, and balances weekday
mix by comparing each weekday separately with equal weights. Each weekday needs
at least two quiet observations per period; at least three weekday groups, six
observations and three calendar weeks per period must remain.

It compares the lower 30% level and checks the 20% and 40% levels agree. Higher or
Lower needs at least a 15% median paired weekday change, five downloads/day in
median levels, and agreement on direction across at least two thirds of weekdays.
All three quantile comparisons must move at least 5% in that direction. Steady
requires the middle estimate within 15%, with all three within 20%. Otherwise the
label is Uneven. Below 20/day it says Low volume; missing data says No data.

This is observed download movement, including lingering update activity. It is
**not release-adjusted growth**, has no displayed growth percentage, and cannot
create a decline alert. Changing release cadence can still move this quiet level.
The card and details explicitly label the observation separately from the stronger
comparison below.

The **release-adjusted check**, available inside a card, also uses two adjacent
**42-day UTC periods**, excluding today. It requires complete daily history and
published, dated release history.

1. Exclude days 0–3 after a release. For each remaining day, identify its weekday,
   age since the latest release, and release count in the preceding 28 days.
   Days lacking 28 days of release-history coverage cannot be matched.
2. Pair old/recent observations on the same weekday, same release-age band
   (4–6, 7–13, 14–27, or 28+ days), and same recent release-count category
   (0, 1, 2, or 3+). Require age differences of at most two days below day 14,
   and four days below day 28. Older ages are capped at 28 for matching.
   A dynamic program maximizes pair count, then minimizes age differences.
   Counts never influence matching and no day is reused.
3. Estimate change using the median paired log ratio, with a one-download
   pseudocount so isolated zero observations do not generate infinity. Require
   ten pairs spanning at least four weeks in each period and four weekdays.
4. Recompute after removing each individual calendar week on either side. The
   resulting range is a sensitivity check, **not a statistical confidence
   interval**. Serially correlated update tails cannot be treated as independent
   observations.
5. Repeat matching after excluding the first **seven** days after each release.
   Require six pairs across three weeks per period and three weekdays. Estimates
   must differ by no more than ten percentage points.
6. Up/down requires a 10% change in both comparisons, consistent leave-week-out
   directions, and at least five downloads/day difference in median matched
   levels. Below 20 downloads/day, or with a prior level below five, stay unclear.
   Steady requires both comparisons within 10% and the primary sensitivity range
   within 15%. Otherwise the adjusted estimate is unavailable and its percentage
   remains hidden; the descriptive quiet reading is still shown on the card.

A weekly release schedule may never leave enough quiet days for a confident
answer. An unavailable adjusted estimate does not mean unhealthy. The method is a
conservative heuristic, not a causal model or an estimate of new-user growth.
Changelog omissions, release-day time zones, update tails lasting weeks, changing
update adoption, seasonality, and traffic sources can still confound the result.
No algorithm can fully separate installs from updates in aggregate downloads.

The small chart is descriptive: a trailing 14-day lower quantile (30%) and a
20–50% band from days at least four days after a release. At least four observations
are required per window; gaps stay gaps. Card bars show raw daily downloads,
with tall peaks capped visually to keep the quiet line readable. Tooltips retain
the actual counts; the detail view has the uncapped chart. This chart is **not**
the matched growth calculation. Each chart starts at zero and has its own scale.

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
- Only the last 365 daily counts and parsed metadata are serialized to clients.
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

Coverage includes stable and changing demand; isolated zeros, spikes and bad
weeks; missing data; changing release schedules with 2/5/10/20-day exponential
update tails; actual AI Engine and Perfect Images regression fixtures; release
threshold boundaries; UTC windows and aggregation; concurrent cache requests,
restart persistence, stale fallback, retry cooldown and recovery.

No deployment is performed by development or verification commands.
