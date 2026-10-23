const { db, must } = require('../lib/db');
const { send, route, bad, body, toSettings, ISO, MAX_DAYS } = require('../lib/http');

module.exports = route({
  PUT: {
    write: true,
    run: async (req, res) => {
      const b = body(req);
      const title = String(b.title || '').trim();
      if (!title || title.length > 80) throw bad('Give the board a title under 80 characters.');
      const subtitle = String(b.subtitle || '').trim().slice(0, 200);
      if (!ISO.test(b.rangeStart) || !ISO.test(b.rangeEnd)) throw bad('Start and end dates are required.');
      const days = (Date.parse(b.rangeEnd) - Date.parse(b.rangeStart)) / 86400000 + 1;
      if (!(days >= 1 && days <= MAX_DAYS)) throw bad(`The range must be between 1 and ${MAX_DAYS} days.`);
      const offDays = [...new Set((Array.isArray(b.offDays) ? b.offDays : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
      const row = must(await db().from('board_settings')
        .upsert({ id: 1, title, subtitle, range_start: b.rangeStart, range_end: b.rangeEnd, off_days: offDays })
        .select().single());
      send(res, 200, toSettings(row));
    }
  }
});
