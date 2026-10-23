// The Supabase URL and anon key are public by design: they only allow what the row-level security policies allow (read-only here).
const { send, route } = require('../lib/http');

module.exports = route({
  GET: (req, res) => send(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || null
  })
});
