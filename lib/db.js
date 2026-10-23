// Server-side Supabase client. Uses the service role key, which must never reach the browser.
const { createClient } = require('@supabase/supabase-js');

let client;
function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw Object.assign(new Error('The server is missing its Supabase settings.'), { status: 500 });
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

// Unwraps a Supabase response; database detail goes to the log, not to the browser.
function must({ data, error }) {
  if (error) {
    console.error('Supabase error:', error);
    throw Object.assign(new Error('The database did not accept that request.'), { status: 502 });
  }
  return data;
}

module.exports = { db, must };
