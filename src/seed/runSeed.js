/**
 * One-time seeding. `npm run seed`.
 *
 * Reads .env with node --env-file, so it uses the same VITE_ values the app
 * does — including the anon key, which means the RLS policies apply exactly
 * as they do in the browser. That is on purpose: if this script can write,
 * the rules permit it, and if it cannot, you have learned something true
 * about your policies before you learn it in production.
 *
 * So it needs an owner session. Set SEED_EMAIL and SEED_PASSWORD, or run it
 * once with a service_role key in SUPABASE_SERVICE_ROLE_KEY and then delete
 * that value — never commit it, never put it in the host's environment, and
 * never let it reach the browser. See ACCESS.md.
 */

import { createClient } from "@supabase/supabase-js";
import { tasks, milestones, deals, attendance } from "../data/seed.example.js";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;

if (!url || !(anonKey || serviceKey)) {
  console.error("Missing VITE_SUPABASE_URL and a key. Copy .env.example to .env first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  if (!serviceKey) {
    if (!email || !password) {
      console.error(
        "Seeding with the anon key needs an owner session.\n" +
          "Set SEED_EMAIL and SEED_PASSWORD (add a password to your user in the\n" +
          "Supabase dashboard first), or set SUPABASE_SERVICE_ROLE_KEY for one run.",
      );
      process.exit(1);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`Could not sign in as ${email}: ${error.message}`);
      process.exit(1);
    }
    console.log(`Signed in as ${email}.`);
  } else {
    console.warn(
      "Using the service_role key. It bypasses every access rule.\n" +
        "Remove it from your environment as soon as this finishes.",
    );
  }

  const batches = [
    ["tasks", tasks],
    ["milestones", milestones],
    ["deals", deals],
    ["attendance_logs", attendance],
  ];

  for (const [table, rows] of batches) {
    if (!rows.length) continue;
    const { error } = await supabase.from(table).insert(rows);
    if (error) {
      console.error(`\n${table}: ${error.message}`);
      if (/row-level security/i.test(error.message)) {
        console.error(
          "The server refused the write. That is the policy working — the\n" +
            "account you used is not on the owner list in supabase/schema.sql.",
        );
      }
      process.exit(1);
    }
    console.log(`${table}: inserted ${rows.length}`);
  }

  console.log("\nDone. Reload the dashboard.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
