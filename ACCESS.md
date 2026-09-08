# Access control

## The short version

The site is a set of static files on GitHub Pages. Anyone can download the whole
bundle, read every line of it, and flip any variable in it. So **nothing in the
browser can be a lock.**

`useCanEdit()` decides which buttons render. That's it. What actually stops
someone changing your data is the row-level security policy in Postgres, checked
by Supabase on the server for every single request.

Both layers have to exist. The code is the first. `supabase/schema.sql` is the
second, and it's the one that matters.

## What each piece does

| Layer | Where | What it is |
| --- | --- | --- |
| Owner allowlist | `VITE_OWNER_EMAILS` | A list of emails baked into the bundle. Cosmetic. |
| Edit affordances | `useCanEdit()` | Hides buttons from visitors. Cosmetic. |
| `/admin` redirect | `src/pages/Admin.jsx` | Courtesy redirect. Cosmetic. |
| Sign-in | `src/pages/Login.jsx` | Emails you a one-time link. No password exists. |
| Write funnel | `src/lib/db.js` → `write.*` | One place to audit every mutation. |
| **RLS policies** | **`supabase/schema.sql`** | **The lock. Server-side. Not bypassable from the browser.** |

There is no password field anywhere. A password compared in JavaScript is
readable by anyone who opens devtools, and on a static host there's nowhere else
to compare it. Magic-link sign-in avoids the problem entirely: there is no
password to steal, guess, or reuse.

## Setup, in order

1. Create a Supabase project (free tier is fine).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, change
   `you@example.com` to your real address, and run it.
3. **Settings → API**: copy the project URL and the `anon` key.
4. Put both in `.env` locally, and in GitHub under **Settings → Secrets and
   variables → Actions → Variables** as `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` and `VITE_OWNER_EMAILS`.
5. **Authentication → URL Configuration**: add your Pages URL
   (`https://<you>.github.io/<repo>/`) to the redirect allowlist, or the sign-in
   link will bounce you somewhere else.
6. Push to `main`. The workflow builds and deploys.

## About the anon key being public

It is supposed to be. It ships in the JavaScript bundle of every Supabase site on
the internet, and Supabase documents it as public. It identifies the project; it
grants nothing on its own. Every request it makes is still filtered through the
RLS policies, which is why step 2 is not optional.

**The `service_role` key is the opposite.** It bypasses every policy. It must
never appear in `.env`, in the workflow, in the repo, or in the browser. The only
place it belongs is a one-off local seeding run, deleted afterwards.

## Verify the lock actually holds

Hiding buttons proves nothing. This proves the server is enforcing the rule.
Do it once, and again after any policy change.

1. **Signed out, private window.** Open the site. You should see all the data, a
   "View only" chip, and no edit controls.
2. Open the console and try a write directly:
   ```js
   const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
   const db = createClient("<your url>", "<your anon key>");
   await db.from("tasks").insert({ title: "should fail", workstream: "ops", week_index: 1 });
   ```
3. **This must return an error mentioning row-level security.** If it returns
   data, your policies did not apply and anyone on the internet can write to your
   database. Re-run `schema.sql`.
4. Sign in as the owner and confirm the same call succeeds.

Until you have watched step 3 fail, assume the data is open.

## Read this before you share the link

"View only" controls editing, not confidentiality. A visitor with the URL sees
every client name and contact, every deal value, retainer and probability, your
pipeline against target, which deals are grant-funded, and your attendance record
down to clock-in times.

That is a fairly complete commercial picture of the business, and on GitHub Pages
the URL is the only thing standing between it and the open internet — a public
repo also means the site is trivially discoverable.

Three ways to handle it:

1. **Treat the URL as the secret.** What it does today. Fine for a link you paste
   into a proposal; not fine if you expect privacy.
2. **Require sign-in to read.** Change each `for select using (true)` policy in
   `schema.sql` to `using (auth.role() = 'authenticated')`. Nobody sees anything
   without an account you approve.
3. **Redact for visitors.** Keep public read on tasks and milestones, restrict
   `deals` and `attendance_logs` to owners. Visitors see the shape of the
   business without the numbers. This is the middle ground and usually the right
   one for a dashboard you want to show people.

Decide deliberately rather than by omission.
