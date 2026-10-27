import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, assessPlugin, estimateTrend, parseReleases, portfolioChange, releaseStatus } from '../libs/health.mjs';
import { windowDates, DAY } from '../libs/metrics.mjs';
const asOf = '2026-10-24T12:00:00Z';
const dates = windowDates(asOf, 728);
const weekdays = [0.7, 1.15, 1.1, 1, 1.05, 1, 0.75];
// `growth` is the yearly multiplier; `season` adds the same yearly wave to both years.
const history = (growth = 1, extra = () => 0, season = 0) => dates.map((date, i) => ({ date,
  value: Math.round(100 * weekdays[new Date(date).getUTCDay()] * growth ** (i / 364) * (1 + season * Math.sin(i / 364 * 2 * Math.PI)) + extra(i)) }));
const plugin = (overrides = {}) => ({ slug: 'test', available: true, lastUpdated: '2026-10-01T00:00:00Z', tested: '7.1', openSupport: 0, numRatings: 10, rating: 100, downloads: history(), releases: [], ...overrides });

test('flat demand stays steady and sustained changes are measured', () => {
  assert.equal(estimateTrend(history(), asOf).direction, 'steady');
  const growing = estimateTrend(history(1.4), asOf), falling = estimateTrend(history(0.65), asOf);
  assert.equal(growing.direction, 'up');
  assert.ok(Math.abs(growing.change - 40) < 3, growing.change);
  assert.equal(falling.direction, 'down');
  assert.ok(Math.abs(falling.change + 35) < 3, falling.change);
});
test('a strong season repeated every year does not create a trend', () => {
  assert.equal(estimateTrend(history(1, () => 0, 0.4), asOf).direction, 'steady');
});
test('release spikes and one unusual month cannot create a direction', () => {
  const spikes = (i) => i % 10 === 0 ? 3000 : i % 10 === 1 ? 1200 : 0;
  assert.equal(estimateTrend(history(1, spikes), asOf).direction, 'steady');
  assert.equal(estimateTrend(history(1, (i) => i >= 600 && i < 628 ? 400 : 0), asOf).direction, 'steady');
});
test('a good year with a falling recent quarter reads mixed, not growing', () => {
  const trend = estimateTrend(history(1.3, (i) => i >= 644 ? -60 : 0), asOf);
  assert.equal(trend.direction, 'mixed');
});
test('missing history and low volumes stay unknown', () => {
  const young = estimateTrend(history().slice(400), asOf);
  assert.equal(young.available, false);
  assert.equal(young.change, null);
  assert.equal(estimateTrend(null, asOf).direction, 'missing');
  assert.equal(estimateTrend(history().map((p) => ({ ...p, value: 3 })), asOf).direction, 'low');
});
test('the current partial day is excluded and isolated zeros change nothing', () => {
  const data = history(); data[700].value = 0;
  data.push({ date: asOf.slice(0, 10), value: 0 });
  assert.equal(estimateTrend(data, asOf).direction, 'steady');
});
test('portfolio change is the median of readable plugins', () => {
  const trends = [1.2, 1.5, 0.8, 1].map((growth) => estimateTrend(history(growth), asOf));
  trends.push(estimateTrend(history().map((p) => ({ ...p, value: 3 })), asOf));
  assert.ok(Math.abs(portfolioChange(trends) - 10) < 3);
  assert.equal(portfolioChange(trends.slice(0, 2)), null);
});
test('release dates exclude unreleased versions and reject invalid dates', () => {
  const parsed = parseReleases('<h4>1.2.0 (2026/10/26)</h4><h4>1.1.0 (2026/10/23)</h4><h4>1.0.0 (2026/02/30)</h4><h4>0.9.0 (2025/12/01)</h4>', '1.1.0');
  assert.deepEqual(parsed, [{ version: '0.9.0', date: '2025-12-01' }, { version: '1.1.0', date: '2026-10-23' }]);
});
test('32/64-day release thresholds and action ordering', () => {
  assert.deepEqual(DEFAULT_POLICY, { warningDays: 32, overdueDays: 64 });
  for (const [age, state] of [[31, 'fresh'], [32, 'soon'], [63, 'soon'], [64, 'overdue']]) {
    const lastUpdated = new Date(Date.parse(asOf) - age * DAY).toISOString();
    assert.equal(releaseStatus(plugin({ lastUpdated }), asOf).state, state);
  }
  const overdue = assessPlugin(plugin({ lastUpdated: '2026-01-01' }), '7.1.3', asOf);
  const noisy = assessPlugin(plugin({ openSupport: 1000, downloads: history(0.5) }), '7.2', asOf);
  assert.ok(overdue.score > noisy.score);
  assert.equal(overdue.actions[0].kind, 'release');
  assert.ok(noisy.actions.some((action) => action.kind === 'trend'));
});
