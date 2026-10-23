# Nafaqati Sprint Board

A sprint board (Board, Gantt and Table views) that runs on Vercel with a Supabase Postgres database. It is separate from the Nafaqati backend.

- Anyone with the link can **view** the board. It updates live.
- Anyone who also has the **edit key** can add, move, edit and delete cards. Those changes reach everyone's screen.
- "Board settings" (after unlocking) changes the title, the date range (up to 120 days) and the days off. Extend the last day to keep adding weeks.

## 1. Set up Supabase (once)

1. Create a project at supabase.com.
2. SQL editor: run `supabase/schema.sql`, then `supabase/seed.sql` (it loads the 19 cards from the local board; skip it for an empty board).
3. Project Settings > API: copy the **Project URL**, the **anon public** key and the **service_role** key.

The service_role key bypasses all security. Put it only in `.env.local` and in Vercel's environment variables. Do not commit it, paste it into chat or put it in the browser code.

## 2. Run it locally

```powershell
cd D:\nafaqati-board
copy .env.example .env.local     # then fill in the four values
npm install
npm run dev                      # http://localhost:3000
npm test                         # API checks against an in-memory stand-in for Supabase
```

## 3. Deploy to Vercel

Either connect a GitHub repository to Vercel ("Add New Project" > Import), or run `npx vercel` in this folder and then `npx vercel --prod`.

In Vercel > Project Settings > Environment Variables add, for Production (and Preview if you use it):

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | publishable (or anon) key |
| `SUPABASE_SECRET_KEY` | secret (or service_role) key |
| `EDIT_KEY` | a long random string; share it with people who may edit |

Redeploy after adding them. Vercel serves `public/` as the site and each file in `api/` as a serverless function.

## How it fits together

- The browser reads the board through `/api/board` and listens to Supabase Realtime (read-only, using the anon key) for changes. If Realtime is unreachable it refreshes every 5 seconds.
- Every write goes through `/api/*` on Vercel, which checks the `x-edit-key` header and then writes with the service role key. The database's row-level security allows the public to read and nobody else to write.
- To add more days, open Board settings and move the final day forward. Cards are rows in `public.tasks`, so you can also edit them in the Supabase table editor.

## API

| Method | Path | Needs key | Purpose |
|---|---|---|---|
| GET | `/api/board` | no | Settings and all cards |
| GET | `/api/config` | no | Public Supabase URL and anon key for Realtime |
| GET | `/api/me` | no | Whether the supplied key can edit |
| POST | `/api/tasks` | yes | Add a card |
| PATCH | `/api/tasks/:id` | yes | Change a card |
| DELETE | `/api/tasks/:id` | yes | Remove a card |
| PUT | `/api/settings` | yes | Title, subtitle, date range, days off |

`scripts/export-seed.js` regenerates `supabase/seed.sql` from an old local SQLite file (`data/board.db`).
