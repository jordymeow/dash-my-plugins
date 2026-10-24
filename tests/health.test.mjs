import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_POLICY, TREND_DAYS, assessPlugin, estimateTrend, parseReleases, releaseStatus } from '../libs/health.mjs';
import { windowDates, DAY } from '../libs/metrics.mjs';
const asOf = '2026-10-24T12:00:00Z';
const dates = windowDates(asOf, TREND_DAYS);
const oldRelease = [{ version: '1.0', date: '2025-01-01' }];
const weekdays = [0.7, 1.15, 1.1, 1, 1.05, 1, 0.75];
const history = (change = 1, extra = () => 0) => dates.map((date, i) => ({ date, value: Math.round(100 * weekdays[new Date(date).getUTCDay()] * (i < 42 ? 1 : change) + extra(i)) }));
const plugin = (overrides = {}) => ({ slug: 'test', available: true, lastUpdated: '2026-10-01T00:00:00Z', tested: '7.1', openSupport: 0, numRatings: 10, rating: 100, downloads: history(), releases: oldRelease, ...overrides });

test('flat demand stays steady and true sustained changes remain visible', () => {
  assert.equal(estimateTrend(history(), asOf, oldRelease).direction, 'steady');
  const growing = estimateTrend(history(1.4), asOf, oldRelease);
  const falling = estimateTrend(history(0.65), asOf, oldRelease);
  assert.equal(growing.direction, 'up');
  assert.ok(growing.change > 38 && growing.change < 41);
  assert.equal(falling.direction, 'down');
  assert.ok(falling.change < -34 && falling.change > -36);
});
test('an isolated spike or one unusual week cannot create a direction', () => {
  assert.equal(estimateTrend(history(1, i => i === 70 ? 10000 : 0), asOf, oldRelease).direction, 'steady');
  assert.equal(estimateTrend(history(1, i => i >= 70 && i < 77 ? 10000 : 0), asOf, oldRelease).direction, 'steady');
});
test('missing days, missing release history and low volumes stay unknown', () => {
  const missing = estimateTrend(history().slice(1), asOf, oldRelease);
  assert.equal(missing.available, false);
  assert.equal(missing.change, null);
  assert.equal(estimateTrend(history(), asOf).change, null);
  assert.equal(estimateTrend(history().map(p => ({ ...p, value: 3 })), asOf, oldRelease).direction, 'uncertain');
});
test('current partial day is excluded and one zero does not invent a decline', () => {
  const data = history(); data[70].value = 0;
  data.push({ date: asOf.slice(0,10), value: 0 });
  assert.equal(estimateTrend(data, asOf, oldRelease).direction, 'steady');
});
test('release dates exclude unreleased versions and reject invalid dates', () => {
  const parsed = parseReleases('<h4>1.2.0 (2026/10/26)</h4><h4>1.1.0 (2026/10/23)</h4><h4>1.0.0 (2026/02/30)</h4><h4>0.9.0 (2025/12/01)</h4>', '1.1.0');
  assert.deepEqual(parsed, [{version:'0.9.0',date:'2025-12-01'}, {version:'1.1.0',date:'2026-10-23'}]);
});
test('32/64-day release thresholds and action ordering', () => {
  assert.deepEqual(DEFAULT_POLICY, { warningDays:32, overdueDays:64 });
  for (const [age, state] of [[31,'fresh'],[32,'soon'],[63,'soon'],[64,'overdue']]) {
    const lastUpdated = new Date(Date.parse(asOf) - age * DAY).toISOString();
    assert.equal(releaseStatus(plugin({lastUpdated}), asOf).state, state);
  }
  const overdue = assessPlugin(plugin({lastUpdated:'2026-01-01'}), '7.1.3', asOf);
  const noisy = assessPlugin(plugin({openSupport:1000,downloads:history(0.5)}), '7.2', asOf);
  assert.ok(overdue.score > noisy.score);
  assert.equal(overdue.actions[0].kind, 'release');
});
test('a change in release frequency alone must not invent growth or decline', () => {
  for (const [before, after] of [[7,21],[21,7],[10,14],[14,10],[7,28],[28,7]]) {
    for (const decay of [2,5,10,20]) {
      const dayZero = Date.parse(dates[0]);
      const releaseDays = [];
      for (let i = -140; i < 42; i += before) releaseDays.push(i);
      for (let i = 42; i < 84; i += after) releaseDays.push(i);
      const releases = releaseDays.map(i => ({ date:new Date(dayZero+i*DAY).toISOString().slice(0,10),version:'1.0' }));
      const data = dates.map((date,i) => ({date,value:Math.round((100 + releaseDays.filter(day => day <= i).reduce((sum,day) => sum + 1500*Math.exp(-(i-day)/decay),0)) * weekdays[new Date(date).getUTCDay()])}));
      const trend = estimateTrend(data,asOf,releases);
      assert.ok(['steady','uncertain'].includes(trend.direction), `${before}→${after}, tail ${decay}: ${trend.direction} ${trend.change}`);
    }
  }
});
test('AI Engine and Perfect Images do not claim a decline without comparable data', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/release-cadence-2026-10-24.json', import.meta.url)));
  for (const p of fixture.plugins) {
    const trend = estimateTrend(p.downloads, fixture.asOf, p.releases);
    assert.equal(trend.direction, 'uncertain', p.slug);
    assert.equal(trend.change, null, p.slug);
    assert.equal(assessPlugin(plugin(p), '7.1.3', fixture.asOf).actions.some(a => a.kind === 'trend'), false);
  }
});

test('real demand changes are still detected underneath a repeated release cycle', () => {
  const dayZero = Date.parse(dates[0]);
  const releaseDays = Array.from({length:17}, (_,i) => -140+i*14);
  const releases = releaseDays.map(i => ({date:new Date(dayZero+i*DAY).toISOString().slice(0,10),version:'1.0'}));
  for (const [factor, direction] of [[0.5,'down'],[1,'steady'],[1.5,'up']]) {
    const data = dates.map((date,i) => ({date,value:Math.round((100*(i<42?1:factor)+releaseDays.filter(day=>day<=i).reduce((sum,day)=>sum+1500*Math.exp(-(i-day)/2),0))*weekdays[new Date(date).getUTCDay()])}));
    assert.equal(estimateTrend(data,asOf,releases).direction,direction);
  }
});

test('observed quiet levels distinguish higher, lower and steady without fabricating growth percentages', () => {
  for (const [factor, label] of [[1,'Steady'],[1.4,'Higher'],[0.6,'Lower']]) {
    const quiet = estimateTrend(history(factor), asOf, oldRelease).quiet;
    assert.equal(quiet.label,label);
    assert.ok(quiet.available);
  }
  assert.equal(estimateTrend(history(1,i=>i===70?10000:0),asOf,oldRelease).quiet.label,'Steady');
  assert.equal(estimateTrend(history().slice(1),asOf,oldRelease).quiet.available,false);
  assert.equal(estimateTrend(history(),asOf,[]).quiet.available,false);
});
test('observed quiet labels do not override the release-adjusted health decision', () => {
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/release-cadence-2026-10-24.json',import.meta.url)));
  for (const p of fixture.plugins) {
    const health=assessPlugin(plugin(p),'7.1.3',fixture.asOf);
    assert.ok(health.trend.quiet.available);
    assert.equal(health.trend.comparable,false);
    assert.equal(health.trend.change,null);
    assert.equal(health.actions.some(action=>action.kind==='trend'),false);
  }
});
test('low observed volume is identified instead of giving a confident direction', () => {
  const quiet=estimateTrend(history().map(point=>({...point,value:3})),asOf,oldRelease).quiet;
  assert.equal(quiet.label,'Low volume');
  assert.equal(quiet.baseline,3);
});
