const { db, must } = require('../lib/db');
const { send, route, toTask, toSettings } = require('../lib/http');

module.exports = route({
  GET: async (req, res) => {
    const [tasks, settings] = await Promise.all([
      db().from('tasks').select('*').order('position').order('id').then(must),
      db().from('board_settings').select('*').eq('id', 1).maybeSingle().then(must)
    ]);
    send(res, 200, { settings: toSettings(settings), tasks: tasks.map(toTask) });
  }
});
