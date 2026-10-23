const { db, must } = require('../../lib/db');
const { send, route, body, parseTask, toTask } = require('../../lib/http');

async function load(req) {
  const id = Number(req.query.id);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('Unknown card.'), { status: 404 });
  const cur = must(await db().from('tasks').select('*').eq('id', id).maybeSingle());
  if (!cur) throw Object.assign(new Error('That card no longer exists.'), { status: 404 });
  return cur;
}

module.exports = route({
  PATCH: {
    write: true,
    run: async (req, res) => {
      const cur = await load(req);
      const t = parseTask(body(req), true);
      if (t.status && t.status !== cur.status && t.position === undefined) {
        const rows = must(await db().from('tasks').select('position').eq('status', t.status).order('position', { ascending: false }).limit(1));
        t.position = (rows[0] ? rows[0].position : 0) + 1000;
      }
      const next = { ...cur, ...t };
      if (!next.start_date || (next.end_date && next.end_date <= next.start_date)) next.end_date = null;
      const row = must(await db().from('tasks').update({
        title: next.title, notes: next.notes, status: next.status, area: next.area, priority: next.priority,
        start_date: next.start_date, end_date: next.end_date, assignee: next.assignee, position: next.position,
        updated_at: new Date().toISOString()
      }).eq('id', cur.id).select().single());
      send(res, 200, toTask(row));
    }
  },
  DELETE: {
    write: true,
    run: async (req, res) => {
      const cur = await load(req);
      must(await db().from('tasks').delete().eq('id', cur.id));
      send(res, 204);
    }
  }
});
