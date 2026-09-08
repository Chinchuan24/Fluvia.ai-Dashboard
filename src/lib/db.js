/**
 * The only file that talks to the database.
 *
 * Everything else imports `read`, `write` or `subscribe` from here and never
 * touches the Supabase client directly. That is what makes the write funnel
 * auditable: every mutation the app can perform is one of the functions in
 * `write` below, so reviewing what this dashboard can change means reading a
 * single file.
 *
 * None of it is a security boundary. This code ships to the browser and can
 * be edited by whoever downloads it. The rules that actually hold are the
 * row-level security policies in supabase/schema.sql, applied by Postgres on
 * every request. See ACCESS.md.
 */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * The app is useful — read-only — without credentials, and the panels explain
 * themselves when there is no client. So a missing config is a visible,
 * recoverable state rather than a white screen.
 */
export const isConfigured = Boolean(url && anonKey);

export const configError = isConfigured
  ? null
  : "Supabase is not configured. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.";

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The magic-link callback arrives as a URL fragment. Reading it is
        // what turns the click into a session, so this must stay on.
        detectSessionInUrl: true,
      },
    })
  : null;

export const TABLES = ["tasks", "milestones", "deals", "attendance_logs"];

// --- Reading ----------------------------------------------------------------

async function selectAll(table, order) {
  if (!supabase) return [];
  const query = supabase.from(table).select("*");
  for (const { column, ascending } of order) {
    query.order(column, { ascending, nullsFirst: false });
  }
  const { data, error } = await query;
  if (error) throw describe(error, `load ${table}`);
  return data ?? [];
}

export const read = {
  tasks: () =>
    selectAll("tasks", [
      { column: "week_index", ascending: true },
      { column: "due_date", ascending: true },
    ]),
  milestones: () =>
    selectAll("milestones", [{ column: "week_index", ascending: true }]),
  deals: () =>
    selectAll("deals", [{ column: "value_sgd", ascending: false }]),
  attendance: () =>
    selectAll("attendance_logs", [{ column: "day_key", ascending: false }]),
};

/** Everything the dashboard needs, in one round trip's worth of parallelism. */
export async function readAll() {
  const [tasks, milestones, deals, attendance] = await Promise.all([
    read.tasks(),
    read.milestones(),
    read.deals(),
    read.attendance(),
  ]);
  return { tasks, milestones, deals, attendance };
}

// --- Writing ----------------------------------------------------------------
//
// Every mutation in the application is below. If it is not here, the app
// cannot do it.

async function insert(table, row) {
  const { data, error } = await requireClient()
    .from(table)
    .insert(row)
    .select()
    .single();
  if (error) throw describe(error, `create in ${table}`);
  return data;
}

async function patch(table, id, changes) {
  const { data, error } = await requireClient()
    .from(table)
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw describe(error, `update ${table}`);
  return data;
}

async function remove(table, id) {
  const { error } = await requireClient().from(table).delete().eq("id", id);
  if (error) throw describe(error, `delete from ${table}`);
  return true;
}

export const write = {
  tasks: {
    create: (row) => insert("tasks", row),
    update: (id, changes) => patch("tasks", id, changes),
    remove: (id) => remove("tasks", id),
    /** Dragging a bar moves the plan, never the deadline. See weeks.js. */
    moveToWeek: (id, weekIndex) => patch("tasks", id, { week_index: weekIndex }),
    setStatus: (id, status) => patch("tasks", id, { status }),
  },
  milestones: {
    create: (row) => insert("milestones", row),
    update: (id, changes) => patch("milestones", id, changes),
    remove: (id) => remove("milestones", id),
    setAchieved: (id, dayKey) => patch("milestones", id, { achieved_at: dayKey }),
  },
  deals: {
    create: (row) => insert("deals", row),
    update: (id, changes) => patch("deals", id, changes),
    remove: (id) => remove("deals", id),
    setStage: (id, stage) => patch("deals", id, { stage }),
  },
  attendance: {
    create: (row) => insert("attendance_logs", row),
    update: (id, changes) => patch("attendance_logs", id, changes),
    remove: (id) => remove("attendance_logs", id),
    /**
     * One row per calendar day, keyed on the SGT day key. Upsert rather than
     * insert so clocking in twice corrects the day instead of failing on the
     * unique constraint.
     */
    upsertDay: async (dayKey, changes) => {
      const { data, error } = await requireClient()
        .from("attendance_logs")
        .upsert({ day_key: dayKey, ...changes }, { onConflict: "day_key" })
        .select()
        .single();
      if (error) throw describe(error, "save attendance");
      return data;
    },
  },
};

// --- Live updates -----------------------------------------------------------

/**
 * Watch every table and call `onChange` when anything moves. Returns an
 * unsubscribe function; call it on unmount or the channel leaks across
 * navigations.
 */
export function subscribe(onChange) {
  if (!supabase) return () => {};
  const channel = supabase.channel("cockpit");
  for (const table of TABLES) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => onChange({ table, event: payload.eventType, row: payload.new ?? payload.old }),
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// --- Auth (thin pass-through; the allowlist lives in auth.jsx) --------------

export const auth = {
  session: async () => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  },
  onChange: (handler) => {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => handler(session));
    return () => data.subscription.unsubscribe();
  },
  sendMagicLink: async (email, redirectTo) => {
    const { error } = await requireClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        // Sign-ups are closed in the Supabase dashboard so that only accounts
        // you create can sign in (ACCESS.md). This asks the server not to
        // create one either way, so a stranger's address is refused rather
        // than quietly registered.
        shouldCreateUser: false,
      },
    });
    if (error) throw describe(error, "send sign-in link");
    return true;
  },
  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
};

// --- Errors -----------------------------------------------------------------

function requireClient() {
  if (!supabase) throw new Error(configError);
  return supabase;
}

/**
 * Turn a Supabase error into something worth showing a person. The RLS case
 * is called out by name because it is the expected refusal, not a fault: it
 * means the server did its job.
 */
function describe(error, action) {
  const message = error?.message ?? String(error);
  if (/row-level security|violates row-level/i.test(message)) {
    const friendly = new Error(
      `Not permitted to ${action}. You are signed in, but this account is not on the owner list in supabase/schema.sql.`,
    );
    friendly.kind = "forbidden";
    friendly.cause = error;
    return friendly;
  }
  if (/JWT|not authenticated|invalid claim/i.test(message)) {
    const friendly = new Error(`Sign in again to ${action} — the session has expired.`);
    friendly.kind = "expired";
    friendly.cause = error;
    return friendly;
  }
  const wrapped = new Error(`Could not ${action}: ${message}`);
  wrapped.kind = "unknown";
  wrapped.cause = error;
  return wrapped;
}
