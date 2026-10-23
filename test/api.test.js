// Exercises the API handlers against an in-memory stand-in for Supabase (no network, no credentials).
// It checks our logic: auth, validation, ordering rules. It cannot prove the real database accepts the SQL schema.
const Module = require('module');
const assert = require('assert');

class Fake {
  constructor() { this.tables = { tasks: [], board_settings: [] }; this.seq = 0; }
  from(name) { return new Q(this, name); }
}
class Q {
  constructor(fake, name) { this.f = fake; this.name = name; this.op = 'select'; this.filters = []; this.sort = []; this.lim = null; this.single_ = null; this.payload = null; }
  select() { if (this.op === 'select') this.op = 'select'; this.ret = true; return this; }
  insert(p) { this.op = 'insert'; this.payload = p; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push([c, v]); return this; }
  order(c, o = {}) { this.sort.push([c, o.ascending === false ? -1 : 1]); return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.single_ = 'one'; return this; }
  maybeSingle() { this.single_ = 'maybe'; return this; }
  then(ok, fail) { return Promise.resolve(this.run()).then(ok, fail); }
  run() {
    const t = this.f.tables[this.name];
    const match = (r) => this.filters.every(([c, v]) => r[c] === v);
    let rows;
    if (this.op === 'insert') {
      const r = { id: ++this.f.seq, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...this.payload };
      t.push(r); rows = [r];
    } else if (this.op === 'update') {
      rows = t.filter(match); rows.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'upsert') {
      let r = t.find((x) => x.id === this.payload.id);
      if (r) Object.assign(r, this.payload); else { r = { ...this.payload }; t.push(r); }
      rows = [r];
    } else if (this.op === 'delete') {
      rows = t.filter(match); this.f.tables[this.name] = t.filter((r) => !match(r)); return { data: null, error: null };
    } else rows = t.filter(match);
    for (const [c, d] of [...this.sort].reverse()) rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * d);
    if (this.lim != null) rows = rows.slice(0, this.lim);
    if (this.single_ === 'one') return rows.length ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } };
    if (this.single_ === 'maybe') return { data: rows[0] || null, error: null };
    return { data: rows.map((r) => ({ updated_at: new Date().toISOString(), ...r })), error: null };
  }
}

const fake = new Fake();
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '@supabase/supabase-js') return { createClient: () => fake };
  return origLoad.call(this, request, ...rest);
};
process.env.SUPABASE_URL = 'http://fake';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.EDIT_KEY = 'secret-key';
process.env.SUPABASE_ANON_KEY = 'anon';

const board = require('../api/board');
const me = require('../api/me');
const config = require('../api/config');
const settings = require('../api/settings');
const tasks = require('../api/tasks/index');
const task = require('../api/tasks/[id]');

function call(handler, method, { body, query, key } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, headers: {}, headersSent: false,
      setHeader(k, v) { this.headers[k] = v; },
      status(n) { this.statusCode = n; return this; },
      json(o) { this.headersSent = true; resolve({ status: this.statusCode, body: o }); },
      end() { this.headersSent = true; resolve({ status: this.statusCode, body: undefined }); }
    };
    handler({ method, body: body || {}, query: query || {}, headers: key ? { 'x-edit-key': key } : {} }, res);
  });
}

(async () => {
  const K = 'secret-key';
  let r = await call(board, 'GET');
  assert.equal(r.status, 200); assert.deepEqual(r.body.tasks, []); assert.equal(r.body.settings.title, 'Sprint Board');

  assert.equal((await call(tasks, 'POST', { body: { title: 'x' } })).status, 401, 'write without key is refused');
  assert.equal((await call(tasks, 'POST', { body: { title: 'x' }, key: 'wrong-key!' })).status, 401, 'wrong key is refused');
  assert.equal((await call(me, 'GET', { key: K })).body.canEdit, true);
  assert.equal((await call(me, 'GET')).body.canEdit, false);
  assert.equal((await call(config, 'GET')).body.supabaseAnonKey, 'anon');

  r = await call(tasks, 'POST', { key: K, body: { title: '  First  ', start: '2026-10-27', end: '2026-10-28' } });
  assert.equal(r.status, 201); assert.equal(r.body.title, 'First'); assert.equal(r.body.start, '2026-10-27'); assert.equal(r.body.position, 1000);
  const id1 = r.body.id;
  r = await call(tasks, 'POST', { key: K, body: { title: 'Second' } });
  assert.equal(r.body.position, 2000, 'new cards go to the bottom of their column');

  assert.equal((await call(tasks, 'POST', { key: K, body: { title: '' } })).status, 400);
  assert.equal((await call(tasks, 'POST', { key: K, body: { title: 'a', status: 'nope' } })).status, 400);
  assert.equal((await call(tasks, 'POST', { key: K, body: { title: 'a', start: '27/10/2026' } })).status, 400);

  r = await call(task, 'PATCH', { key: K, query: { id: String(id1) }, body: { status: 'done' } });
  assert.equal(r.status, 200); assert.equal(r.body.status, 'done'); assert.equal(r.body.position, 1000, 'moving columns puts the card at the bottom');
  r = await call(task, 'PATCH', { key: K, query: { id: String(id1) }, body: { end: '2026-10-26' } });
  assert.equal(r.body.end, null, 'an end before the start is dropped');
  r = await call(task, 'PATCH', { key: K, query: { id: String(id1) }, body: { start: null } });
  assert.equal(r.body.start, null); assert.equal(r.body.end, null);
  assert.equal((await call(task, 'PATCH', { key: K, query: { id: '999' }, body: { status: 'done' } })).status, 404);

  r = await call(settings, 'PUT', { key: K, body: { title: 'Sprint 2', subtitle: 'More days', rangeStart: '2026-10-23', rangeEnd: '2026-12-20', offDays: [0, 6, 6] } });
  assert.equal(r.status, 200); assert.deepEqual(r.body.offDays, [0, 6]);
  assert.equal((await call(settings, 'PUT', { key: K, body: { title: 'x', rangeStart: '2026-10-23', rangeEnd: '2027-06-01' } })).status, 400, 'range over 120 days refused');
  assert.equal((await call(settings, 'PUT', { body: { title: 'x' } })).status, 401);

  assert.equal((await call(task, 'DELETE', { key: K, query: { id: String(id1) } })).status, 204);
  r = await call(board, 'GET'); assert.equal(r.body.tasks.length, 1); assert.equal(r.body.settings.title, 'Sprint 2');
  assert.equal((await call(board, 'POST')).status, 405);

  delete process.env.EDIT_KEY;
  assert.equal((await call(tasks, 'POST', { key: 'anything', body: { title: 'x' } })).status, 503, 'no EDIT_KEY configured means no editing');
  process.env.OPEN_EDITING = 'true';
  r = await call(tasks, 'POST', { body: { title: 'Open card' } });
  assert.equal(r.status, 201, 'open editing needs no key');
  assert.equal((await call(me, 'GET')).body.open, true);
  console.log('All API checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
