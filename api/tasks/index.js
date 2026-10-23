const { db, must } = require('../../lib/db');
const { send, route, body, parseTask, toTask } = require('../../lib/http');

async function tailPosition(status) {
  const rows = must(await db().from('tasks').select('position').eq('status', status).order('position', { ascending: false }).limit(1));
  return (rows[0] ? rows[0].position : 0) + 1000;
}

module.exports = route({
  POST: {
    write: true,
    run: async (req, res) => {
      const t = parseTask(body(req), false);
      const status = t.status || 'todo';
      const row = must(await db().from('tasks').insert({
        title: t.title, notes: t.notes || '', status, area: t.area || 'data', priority: t.priority || 'med',
        start_date: t.start_date || null, end_date: t.start_date ? t.end_date || null : null,
        assignee: t.assignee || '', position: t.position ?? (await tailPosition(status))
      }).select().single());
      send(res, 201, toTask(row));
    }
  }
});
