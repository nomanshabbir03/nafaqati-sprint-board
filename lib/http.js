const crypto = require('crypto');

const STATUSES = ['backlog', 'todo', 'doing', 'review', 'done'];
const AREAS = ['data', 'model', 'sync', 'dash', 'qa'];
const PRIORITIES = ['high', 'med', 'low'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 120;

const DEFAULT_SETTINGS = { title: 'Sprint Board', subtitle: '', rangeStart: '2026-10-23', rangeEnd: '2026-10-29', offDays: [0] };

function send(res, status, body) {
  res.setHeader('cache-control', 'no-store');
  if (body === undefined) return res.status(status).end();
  return res.status(status).json(body);
}

// Routes by method, handles errors and the edit key in one place.
function route(handlers) {
  return async (req, res) => {
    const h = handlers[req.method];
    if (!h) return send(res, 405, { error: 'Method not allowed.' });
    try {
      if (h.write && !requireEditor(req, res)) return;
      await (h.run || h)(req, res);
    } catch (e) {
      if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong on the server.' });
      if (!e.status) console.error(e);
    }
  };
}

// OPEN_EDITING=true lets anyone with the link edit, so no key is needed.
const isOpen = () => String(process.env.OPEN_EDITING || '').toLowerCase() === 'true';

function isEditor(req) {
  if (isOpen()) return true;
  const want = process.env.EDIT_KEY || '';
  if (!want) return false;
  const given = Buffer.from(String(req.headers['x-edit-key'] || ''));
  const need = Buffer.from(want);
  return given.length === need.length && crypto.timingSafeEqual(given, need);
}
function requireEditor(req, res) {
  if (isOpen()) return true;
  if (!process.env.EDIT_KEY) { send(res, 503, { error: 'Editing is not set up: the server has no EDIT_KEY.' }); return false; }
  if (!isEditor(req)) { send(res, 401, { error: 'Editing needs the edit key.' }); return false; }
  return true;
}

const bad = (message) => Object.assign(new Error(message), { status: 400 });
const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

function parseTask(b, partial) {
  const t = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (!partial || has('title')) {
    const v = String(b.title || '').trim();
    if (!v) throw bad('Title is required.');
    if (v.length > 160) throw bad('Title is too long.');
    t.title = v;
  }
  if (has('notes')) { const v = String(b.notes || '').trim(); if (v.length > 2000) throw bad('Notes are too long.'); t.notes = v; }
  if (has('assignee')) { const v = String(b.assignee || '').trim(); if (v.length > 60) throw bad('Owner is too long.'); t.assignee = v; }
  if (has('status')) { if (!STATUSES.includes(b.status)) throw bad('Unknown status.'); t.status = b.status; }
  if (has('area')) { if (!AREAS.includes(b.area)) throw bad('Unknown area.'); t.area = b.area; }
  if (has('priority')) { if (!PRIORITIES.includes(b.priority)) throw bad('Unknown priority.'); t.priority = b.priority; }
  for (const [k, col] of [['start', 'start_date'], ['end', 'end_date']]) {
    if (has(k)) {
      const v = b[k] ? String(b[k]) : null;
      if (v && (!ISO.test(v) || Number.isNaN(Date.parse(v)))) throw bad('Dates must look like 2026-10-23.');
      t[col] = v;
    }
  }
  if (has('position')) { const v = Number(b.position); if (!Number.isFinite(v)) throw bad('Bad position.'); t.position = v; }
  return t;
}

const toTask = (r) => ({
  id: r.id, title: r.title, notes: r.notes, status: r.status, area: r.area, priority: r.priority,
  start: r.start_date, end: r.end_date, assignee: r.assignee, position: r.position, updatedAt: Date.parse(r.updated_at)
});
const toSettings = (r) => (r ? { title: r.title, subtitle: r.subtitle, rangeStart: r.range_start, rangeEnd: r.range_end, offDays: r.off_days || [] } : DEFAULT_SETTINGS);

module.exports = { send, route, isEditor, isOpen, bad, body, parseTask, toTask, toSettings, ISO, MAX_DAYS };
