# Access control

## The short version

The site is a set of static files on Vercel. Anyone can download the whole
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
| **Who may sign in** | **Supabase → Authentication** | **Server-side. Sign-ups off + a user list you control.** |
| Write funnel | `src/lib/db.js` → `write.*` | One place to audit every mutation. |
| **RLS policies** | **`supabase/schema.sql`** | **The lock. Server-side. Not bypassable from the browser.** |

There is no password field anywhere, and no default account. A password compared
in JavaScript is readable by anyone who opens devtools, and on a static host
there's nowhere else to compare it. Magic-link sign-in avoids the problem
entirely: there is no password to steal, guess, or reuse, and nothing to hand
out or leak.

### Close sign-ups, or strangers can make accounts

Supabase lets anyone request a link and creates an account for them by default.
That does not put your data at risk — `is_owner()` refuses their writes either
way, and an account is not permission — but it does mean a stranger can land in
your `auth.users` table, and there is no reason to allow it on a dashboard with
exactly one user.

**Authentication → Sign In / Providers → disable "Allow new users to sign up".**

With that off, only accounts you create yourself can sign in. Create your own
first, or you will lock yourself out of your own dashboard:

**Authentication → Users → Add user**, your address, "Auto Confirm User" on.

You never set a password for it. Sign-in is still the emailed link; the account
simply has to exist beforehand for one to be issued. Someone who is not in that
table gets no link, so they never sign in at all.

That leaves two independent controls, and you want both:

| Question | Where you set it |
| --- | --- |
| Who can sign in at all? | Supabase → Authentication → Users (with sign-ups off) |
| Who can edit once signed in? | `owner_emails()` in `supabase/schema.sql` |

Keep them in step. Removing someone from `owner_emails()` leaves them able to
sign in and read; deleting their row in Users is what removes them entirely.

## Setup, in order

1. Create a Supabase project (free tier is fine).
2. Open **SQL Editor → New query**, paste `supabase/schema.sql`, change
   `you@example.com` to your real address, and run it.
3. **Authentication → Sign In / Providers**: turn off "Allow new users to sign
   up", then **Authentication → Users → Add user** to create your own account
   with "Auto Confirm User" on. Do it in that order — see below.
4. **Settings → API**: copy the project URL and the `anon` key.
5. Put both in `.env` locally, and in Vercel under **Settings → Environment
   Variables** as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
   `VITE_OWNER_EMAILS`, for all three environments.
6. **Authentication → URL Configuration**: set the Site URL to your production
   domain and add it to the redirect allowlist, or the sign-in link will bounce
   you somewhere else. Add `https://*-<your-vercel-scope>.vercel.app/**` too if
   you want sign-in to work on preview deployments — each pull request gets its
   own hostname, and a link issued for one is only valid for the origin it was
   requested from.
7. Push. Vercel builds and deploys the production branch; every other branch
   gets a preview URL.

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

That is a fairly complete commercial picture of the business, and the URL is the
only thing standing between it and the open internet.

Vercel does not require the repository to be public, so making the repo private
is worth doing regardless — it stops the source, and the owner allowlist in it,
from being read by anyone who searches for it. It does not make the *site*
private: the deployment stays open to anyone with the link either way. Only
option 2 or 3 below changes that.

Preview deployments are worth a thought as well. Every branch you push gets its
own public URL pointing at the same production database, so a half-finished
branch is a second live copy of the same data. Vercel can require login to view
previews under Settings → Deployment Protection.

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
