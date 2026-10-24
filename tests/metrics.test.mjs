import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateDownloads, dailyDownloads, downloadWindow, groupDownloads, needsCompatibilityReview, parseWordPressDate, portfolioSummary, signalsFor, windowDates } from '../libs/metrics.mjs';

const asOf = '2026-10-24T13:20:00.000Z';
const history = (current = 20, previous = 10) => windowDates(asOf, 60).map((date, i) => ({ date, value: i < 30 ? previous : current }));
const plugin = (overrides = {}) => ({ name: 'Example', slug: 'example', available: true, activeInstalls: 1000, openSupport: 0, tested: '7.1', rating: 100, numRatings: 5, downloads: history(), ...overrides });

test('WordPress GMT dates are parsed as UTC, including 12am and 12pm', () => {
  assert.equal(parseWordPressDate('2026-10-23 3:28am GMT'), '2026-10-23T03:28:00.000Z');
  assert.equal(parseWordPressDate('2026-10-23 12:01am GMT'), '2026-10-23T00:01:00.000Z');
  assert.equal(parseWordPressDate('2026-10-23 12:01pm GMT'), '2026-10-23T12:01:00.000Z');
  assert.equal(parseWordPressDate('2026-10-23 16:30:00'), '2026-10-23T16:30:00.000Z');
  assert.equal(parseWordPressDate('bad response'), null);
});

test('rolling comparison excludes today and includes exactly two adjacent 30-day periods', () => {
  const data = [...history(), { date: '2026-10-24', value: 999999 }];
  assert.deepEqual(downloadWindow(data, asOf), { current: 600, previous: 300, change: 100 });
  assert.equal(windowDates(asOf)[0], '2026-09-24');
  assert.equal(windowDates(asOf).at(-1), '2026-10-23');
});

test('grouping downloads counts every day once, including the first day of a bucket', () => {
  const data = dailyDownloads({ '2026-10-03': 30, '2026-10-01': 10, '2026-10-02': 20, error: 'unavailable' });
  assert.deepEqual(groupDownloads(data, 2).map((point) => point.value), [30, 30]);
  assert.equal(groupDownloads(data, 3)[0].value, 60);
  assert.equal(data[0].date, '2026-10-01');
});

test('missing history is not silently converted to zero or a negative growth rate', () => {
  assert.equal(downloadWindow(null, asOf).current, null);
  assert.equal(downloadWindow(history().slice(1), asOf).change, null);
  assert.deepEqual(downloadWindow(history(0, 0), asOf), { current: 0, previous: 0, change: null });
});

test('portfolio comparison uses the same complete cohort in both periods', () => {
  const summary = portfolioSummary([plugin(), plugin({ downloads: history(1000, 2000).slice(10) })], asOf);
  assert.equal(summary.downloads, 600);
  assert.equal(summary.change, 100);
  assert.equal(summary.downloadCoverage, 1);
});

test('portfolio chart aligns by date and excludes incomplete series without mutating input', () => {
  const first = plugin(); const second = plugin({ downloads: history(5, 2).reverse() });
  const broken = plugin({ downloads: history().slice(0, -1) });
  const before = JSON.stringify(second);
  const result = aggregateDownloads([first, second, broken], windowDates(asOf, 30));
  assert.equal(result.included, 2);
  assert.equal(result.points.length, 30);
  assert.equal(result.points.reduce((sum, point) => sum + point.value, 0), 750);
  assert.equal(JSON.stringify(second), before);
});

test('rating is review-weighted; an unrated plugin is not a zero-star rating', () => {
  const summary = portfolioSummary([plugin({ rating: 100, numRatings: 1 }), plugin({ rating: 80, numRatings: 9 }), plugin({ rating: 0, numRatings: 0 })], asOf);
  assert.equal(summary.rating, 4.1);
  assert.equal(summary.reviews, 10);
});

test('compatibility compares release lines, not patch versions, and preserves unknown values', () => {
  assert.equal(needsCompatibilityReview('7.1', '7.1.3'), false);
  assert.equal(needsCompatibilityReview('7.0.8', '7.1.3'), true);
  assert.equal(needsCompatibilityReview('7.10', '7.9'), false);
  assert.equal(needsCompatibilityReview(null, '7.1'), null);
  assert.equal(needsCompatibilityReview('7.1', 'Unknown'), null);
});

test('attention flags are actionable and an old release alone is not a warning', () => {
  assert.deepEqual(signalsFor(plugin({ lastUpdated: '2020-01-01' }), '7.1.3'), []);
  assert.equal(signalsFor(plugin({ openSupport: 1 }), '7.1.3')[0].kind, 'support');
  assert.equal(signalsFor(plugin({ available: false }), '7.1.3')[0].kind, 'data');
  assert.deepEqual(signalsFor(plugin({ rating: 0, numRatings: 0 }), '7.1.3'), []);
});
