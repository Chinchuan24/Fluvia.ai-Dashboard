# Fluvia.ai — operations cockpit

A single-page operations dashboard for a Singapore AI-integration consultancy.
Twenty-week programme grid, work list, personal attendance, sales progress and a
milestone rail. Public to read, owner-only to edit.

**Read [ACCESS.md](ACCESS.md) before you share the link.** The site is static, so
nothing in the browser can be a lock — the real one is in `supabase/schema.sql`.
ACCESS.md also covers exactly what a visitor can see.

## Stack

React · React Router · Vite, deployed static to Vercel. Data and auth from
Supabase (Postgres + row-level security). `framer-motion`, `recharts`,
`lucide-react`, `date-fns`. No three.js, GSAP, Lottie or smooth-scroll library —
the ambient layer is plain Canvas 2D.

Routing is `BrowserRouter` with clean paths (`/dashboard`). That relies on the
rewrite in `vercel.json` sending every unmatched path to `index.html`. It also
keeps the URL fragment free for the Supabase magic-link callback, which comes
back as `#access_token=...` and would otherwise be fighting a hash router for
the same part of the URL.

If you move to a host that cannot rewrite — GitHub Pages, plain S3 — switch to
`HashRouter` in `src/main.jsx` and set `BASE_PATH` at build time.

## Routes

| Route | File | Who |
| --- | --- | --- |
| `#/dashboard` | `src/pages/Dashboard.jsx` | anyone — read only |
| `#/admin` | `src/pages/Admin.jsx` | owner — full edit |
| `#/login` | `src/pages/Login.jsx` | magic-link sign-in |

`src/Layout.jsx` is the shared chrome: tokens, ambient canvas, and the bar that
tells you whether you are viewing or editing.

## Getting it running

1. **Create a Supabase project** (free tier), open the SQL editor, paste
   `supabase/schema.sql`, put your email where it says to, and run it. That file
   creates the tables *and* the access rules — it is the security boundary, not
   the app. Then turn off public sign-ups and add yourself as a user — two
   clicks, and without them anyone can create an account. ACCESS.md has the
   exact path.
2. **Copy `.env.example` to `.env`** and fill in the project URL, the anon key
   and your email.
3. **`npm install && npm run dev`** — it runs at `localhost:5173`, empty. Every
   panel tells you what to add.
4. **Deploy.** Import the repo at [vercel.com/new](https://vercel.com/new). It
   detects Vite and reads `vercel.json`, so the build settings need no edits.
   Add the same three values under Settings → Environment Variables, then
   redeploy — Vite inlines `VITE_*` at build time, so a variable added after a
   build is not in the bundle until the next one.
5. **Optional:** `npm run seed` loads sample rows if you'd rather look at a full
   dashboard than an empty one. You don't need it.

Full setup detail, including the Supabase redirect URL step, is in
[ACCESS.md](ACCESS.md).

## Where things live

```
src/
  lib/
    db.js          the ONLY file that talks to the database. Swapping backends
                   touched this file and nothing else
    auth.jsx       owner allowlist (from env) + useCanEdit. Cosmetic — see ACCESS.md
    derive.js      every figure the dashboard shows, computed once
    weeks.js       week_index arithmetic, all of it
    format.js      S$ money, SGT clock, local date keys
    useDashboard.js  load, derive, subscribe, refresh
  components/      one file per module, plus motion.jsx for shared primitives
  pages/           one file per route
  styles/          tokens.css (the design system) + dashboard.css
  data/seed.example.js  fabricated sample data
  seed/runSeed.js  one-time seeding
scripts/
  check-palette.mjs  the colour checks described under Design system
```

## Two things that will bite you

**Dates.** Never use `toISOString().slice(0,10)` to key a calendar day. A midnight
SGT date serialises back into the previous UTC day, and every cell silently shows
the wrong record. Use `ymd()` from `src/lib/format.js`.

**`week_index` vs `due_date`.** `week_index` is stored, not computed, so a bar can
be dragged without moving its deadline. `weekIndexOf()` gives you the default when
creating a task; after that the two are allowed to diverge on purpose.

## Design system

Tokens are declared in `src/styles/tokens.css` and are the only place colours,
type steps and easings are defined. Four hues plus neutrals; every other shade is
derived with `oklch()` from one of them.

The data-visualisation steps — the funnel ramp and the attendance fills — are
validated against the lightness band, chroma floor, Machado-2009 protan/deutan
separation, the normal-vision floor, and WCAG contrast on the dark surface.
Measured values are in the comments in `tokens.css`.

**If you change a chart colour, re-run the checks** rather than eyeballing it:

```
node scripts/check-palette.mjs
```

It fails the run and names the offender. The amber/red pair is the fragile one:
at L 0.80 vs 0.64 the two sit 0.166 apart under deuteranopia, but moved to a
common L 0.72 that falls to 0.055 — under the 0.06 floor, i.e. the same colour.
Hold the lightness gap. The script also catches a chroma that is outside the
sRGB gamut, where the browser silently clips and you get a colour other than the
one you wrote.

## Motion

Motion lives in the chrome, the background and transitions. Data the user is
reading does not move for style: figures count up once on mount and then hold
still, rows never drift, and a record that changes gets a single 400ms border
pulse rather than animating its own value.

Curves and durations come from the tokens (`--ease-out`, `--ease-drawer`, and the
duration steps). Transforms are passed to framer-motion as full strings —
`transform: "translateY(12px)"` — not the `x`/`y`/`scale` shorthands, which are not
hardware accelerated and drop frames while the page is still loading.

`prefers-reduced-motion` drops the ambient canvas and all movement while keeping
opacity fades. Every hover effect is behind `@media (hover: hover) and (pointer: fine)`.
