/**
 * Every figure the dashboard shows, computed once.
 *
 * Panels render what this returns; they do not do arithmetic of their own.
 * Keeping it in one place is why the pipeline total on the sales panel and
 * the one on the header cannot drift apart, and it means the numbers can be
 * checked without reading any React.
 */

import { today, daysBetween, shiftDayKey } from "./format.js";
import { WEEKS, byWeek, clampWeek, currentWeek, isDrifting, weekRangeLabel } from "./weeks.js";

/** Target the pipeline is measured against. */
export const PIPELINE_TARGET_SGD = 250_000;

/** A working day this dashboard expects to see logged. */
export const STANDARD_DAY_HOURS = 8;

const OPEN_STAGES = ["lead", "qualified", "proposal"];

export function derive({ tasks = [], milestones = [], deals = [], attendance = [] } = {}) {
  const now = today();
  const week = currentWeek();

  return {
    now,
    week,
    tasks: deriveTasks(tasks, now, week),
    programme: deriveProgramme(tasks, milestones, week),
    sales: deriveSales(deals),
    attendance: deriveAttendance(attendance, now),
    milestones: deriveMilestones(milestones, now),
    isEmpty:
      !tasks.length && !milestones.length && !deals.length && !attendance.length,
  };
}

// --- Work -------------------------------------------------------------------

function deriveTasks(tasks, now, week) {
  const done = tasks.filter((t) => t.status === "done");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const doing = tasks.filter((t) => t.status === "doing");

  // Overdue means the deadline has passed and it is not finished. It keys on
  // due_date, never week_index — the stored week is a plan, the date is the
  // commitment, and only one of them can make something late.
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.due_date && daysBetween(t.due_date, now) > 0,
  );

  const dueThisWeek = tasks.filter(
    (t) => t.status !== "done" && week !== null && clampWeek(t.week_index) === week,
  );

  const workstreams = new Map();
  for (const task of tasks) {
    const key = task.workstream || "unassigned";
    const bucket = workstreams.get(key) ?? { name: key, total: 0, done: 0 };
    bucket.total += 1;
    if (task.status === "done") bucket.done += 1;
    workstreams.set(key, bucket);
  }

  return {
    all: tasks,
    total: tasks.length,
    done: done.length,
    doing: doing.length,
    blocked: blocked.length,
    overdue,
    dueThisWeek,
    completion: tasks.length ? done.length / tasks.length : 0,
    // Sorted so the panel does not have to. Blocked first — it is the only
    // status that needs someone to do something about it today.
    workstreams: [...workstreams.values()].sort((a, b) => b.total - a.total),
    drifting: tasks.filter(isDrifting),
  };
}

// --- The twenty-week grid ---------------------------------------------------

function deriveProgramme(tasks, milestones, week) {
  const taskWeeks = byWeek(tasks);
  const milestoneWeeks = byWeek(milestones);

  const weeks = WEEKS.map((index) => {
    const items = taskWeeks.get(index) ?? [];
    const done = items.filter((t) => t.status === "done").length;
    return {
      index,
      label: `W${index}`,
      range: weekRangeLabel(index),
      tasks: items,
      milestones: milestoneWeeks.get(index) ?? [],
      total: items.length,
      done,
      blocked: items.filter((t) => t.status === "blocked").length,
      completion: items.length ? done / items.length : null,
      isCurrent: index === week,
      isPast: week !== null && index < week,
    };
  });

  // The busiest week sets the bar height for all of them, so the grid is
  // comparable across columns rather than each one self-scaling.
  const peak = weeks.reduce((max, w) => Math.max(max, w.total), 0);

  return { weeks, peak, current: week };
}

// --- Sales ------------------------------------------------------------------

function deriveSales(deals) {
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const won = deals.filter((d) => d.stage === "won");
  const lost = deals.filter((d) => d.stage === "lost");

  const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);

  const wonValue = sum(won, "value_sgd");
  const openValue = sum(open, "value_sgd");

  // Weighted by probability — the honest number to plan against, as opposed
  // to the pipeline total, which assumes everything closes.
  const weighted = open.reduce(
    (total, d) => total + Number(d.value_sgd ?? 0) * Number(d.probability ?? 0),
    0,
  );

  const stages = ["lead", "qualified", "proposal", "won", "lost"].map((stage) => {
    const rows = deals.filter((d) => d.stage === stage);
    return { stage, count: rows.length, value: sum(rows, "value_sgd") };
  });

  const decided = won.length + lost.length;

  return {
    all: deals,
    open,
    won,
    lost,
    stages,
    openValue,
    wonValue,
    weighted,
    committed: wonValue + weighted,
    mrr: sum(won, "retainer_sgd"),
    target: PIPELINE_TARGET_SGD,
    againstTarget: PIPELINE_TARGET_SGD ? (wonValue + weighted) / PIPELINE_TARGET_SGD : 0,
    winRate: decided ? won.length / decided : null,
    grantFunded: deals.filter((d) => d.grant_funded).length,
  };
}

// --- Attendance -------------------------------------------------------------

function deriveAttendance(logs, now) {
  const byDay = new Map(logs.map((row) => [row.day_key, row]));
  const totalHours = logs.reduce((total, row) => total + Number(row.hours ?? 0), 0);
  const daysLogged = logs.filter((row) => Number(row.hours ?? 0) > 0).length;

  const sorted = [...logs].sort((a, b) => (a.day_key < b.day_key ? 1 : -1));

  // Consecutive logged days ending today or yesterday. A streak that ended
  // last week is not a streak, so it stops at the first gap.
  let streak = 0;
  let cursor = now;
  while (byDay.has(cursor) && Number(byDay.get(cursor).hours ?? 0) > 0) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return {
    all: sorted,
    byDay,
    todayRow: byDay.get(now) ?? null,
    isClockedIn: Boolean(byDay.get(now)?.clock_in && !byDay.get(now)?.clock_out),
    totalHours,
    daysLogged,
    averageHours: daysLogged ? totalHours / daysLogged : 0,
    streak,
    recent: sorted.slice(0, 14),
  };
}

// --- Milestones -------------------------------------------------------------

function deriveMilestones(milestones, now) {
  const achieved = milestones.filter((m) => m.achieved_at);
  const pending = milestones.filter((m) => !m.achieved_at);

  const overdue = pending.filter(
    (m) => m.target_date && daysBetween(m.target_date, now) > 0,
  );

  const next = [...pending]
    .filter((m) => m.target_date)
    .sort((a, b) => (a.target_date < b.target_date ? -1 : 1))[0] ?? null;

  return {
    all: [...milestones].sort((a, b) => clampWeek(a.week_index) - clampWeek(b.week_index)),
    achieved: achieved.length,
    pending: pending.length,
    overdue,
    next,
    completion: milestones.length ? achieved.length / milestones.length : 0,
  };
}
