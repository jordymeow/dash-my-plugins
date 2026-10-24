import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotCache, CACHE_TTL } from '../libs/snapshot-cache.mjs';
const initial = Date.parse('2026-10-24T12:00:00Z');
const snapshot = () => ({ plugins:[{slug:'test'}], fetchedAt:new Date(initial).toISOString() });

test('concurrent refreshes share one request and reuse fresh data', async () => {
  let calls = 0, saved;
  const get = createSnapshotCache({ load: async () => { calls++; return snapshot(); }, read: async () => null, write: async data => { saved=data; }, now:()=>initial });
  const data = await Promise.all([get(),get(),get()]);
  await get();
  assert.equal(calls,1); assert.equal(data[0].stale,false); assert.deepEqual(saved,snapshot());
});
test('fresh disk snapshot survives process restart without fetching', async () => {
  let calls=0;
  const get = createSnapshotCache({load:async()=>{calls++;return snapshot();},read:async()=>snapshot(),write:async()=>{},now:()=>initial+1000});
  assert.equal((await get()).stale,false); assert.equal(calls,0);
});
test('failed refresh keeps the timestamp and limits retry traffic, then recovers', async () => {
  let time=initial+CACHE_TTL+1, calls=0, fail=true;
  const get = createSnapshotCache({load:async()=>{calls++;if(fail)throw Error('offline');return {...snapshot(),fetchedAt:new Date(time).toISOString()};},read:async()=>snapshot(),write:async()=>{},now:()=>time});
  const stale = await get(); await get();
  assert.equal(stale.stale,true);assert.equal(stale.fetchedAt,snapshot().fetchedAt);assert.equal(calls,1);
  time+=61000;fail=false;
  assert.equal((await get()).stale,false);assert.equal(calls,2);
});
test('disk write failure does not break memory caching; no data plus offline is an error', async () => {
  const get=createSnapshotCache({load:async()=>snapshot(),read:async()=>{throw Error('missing');},write:async()=>{throw Error('readonly');},now:()=>initial});
  assert.equal((await get()).stale,false);assert.equal((await get()).stale,false);
  const empty=createSnapshotCache({load:async()=>{throw Error('offline');},read:async()=>null,write:async()=>{},now:()=>initial});
  await assert.rejects(empty(),/offline/);
});
