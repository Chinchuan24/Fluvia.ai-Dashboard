/**
 * week_index arithmetic, all of it.
 *
 * The programme is twenty weeks numbered 1..20. Week 1 starts on
 * PROGRAMME_START, a Monday, and every week runs Monday to Sunday in SGT.
 *
 * `week_index` is *stored* on each row, not derived from its date. That is
 * deliberate: it lets a bar be dragged along the grid without moving its
 * deadline, so planning and committing are separate acts. `weekIndexOf()`
 * supplies the default when a record is created; after that the two are
 * allowed to disagree, and `isDrifting()` is how the UI notices.
 */

import { ymd, fromYmd, daysBetween } from "./format.js";

/**
 * Monday of week 1. Change this and the whole grid moves — it is the single
 * value the twenty-week programme hangs off, so set it to your real start
 * date before entering anything.
 *
 * It must be a Monday. A mid-week date still works arithmetically, but every
 * "week" then runs Thursday to Wednesday, which will not match how anyone
 * talks about the schedule.
 */
export const PROGRAMME_START = "2026-09-07";
export const TOTAL_WEEKS = 20;

export const WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

/** Clamp anything into 1..20 so a bad row can never escape the grid. */
export function clampWeek(index) {
  const n = Math.trunc(Number(index));
  if (!Number.isFinite(n)) return 1;
  return Math.min(TOTAL_WEEKS, Math.max(1, n));
}

/** The week a date falls in, or null if it lands outside the programme. */
export function weekIndexOf(value) {
  const key = typeof value === "string" ? value : ymd(value);
  const offset = daysBetween(PROGRAMME_START, key);
  if (offset === null) return null;
  const index = Math.floor(offset / 7) + 1;
  return index >= 1 && index <= TOTAL_WEEKS ? index : null;
}

/**
 * The same thing, but never null — for creating a record, where a sensible
 * default beats an error. Dates before the programme land in week 1, after
 * it in week 20.
 */
export function defaultWeekFor(value) {
  const key = typeof value === "string" ? value : ymd(value);
  const offset = daysBetween(PROGRAMME_START, key);
  if (offset === null) return 1;
  return clampWeek(Math.floor(offset / 7) + 1);
}

/** Day key of the Monday starting a week. */
export function weekStart(index) {
  const start = fromYmd(PROGRAMME_START);
  if (!start) return null;
  const d = new Date(start.getTime() + (clampWeek(index) - 1) * 7 * 86_400_000);
  return ymd(d);
}

/** Day key of the Sunday ending a week. */
export function weekEnd(index) {
  const start = fromYmd(weekStart(index));
  if (!start) return null;
  return ymd(new Date(start.getTime() + 6 * 86_400_000));
}

/** The seven day keys of a week, Monday first. */
export function weekDays(index) {
  const start = fromYmd(weekStart(index));
  if (!start) return [];
  return Array.from({ length: 7 }, (_, i) =>
    ymd(new Date(start.getTime() + i * 86_400_000)),
  );
}

/** "5 Jan – 11 Jan" */
export function weekRangeLabel(index) {
  const start = weekStart(index);
  const end = weekEnd(index);
  if (!start || !end) return "";
  return `${labelPart(start)} – ${labelPart(end)}`;
}

function labelPart(key) {
  const [, m, d] = key.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}

/** The week the programme is in right now, or null before/after it runs. */
export function currentWeek(now = new Date()) {
  return weekIndexOf(now);
}

/**
 * How far through the programme we are, 0..1. Used by the grid's progress
 * marker, so it saturates rather than going negative or past the end.
 */
export function programmeProgress(now = new Date()) {
  const offset = daysBetween(PROGRAMME_START, ymd(now));
  if (offset === null) return 0;
  return Math.min(1, Math.max(0, offset / (TOTAL_WEEKS * 7)));
}

/**
 * True when a record's stored week no longer matches its due date. Not an
 * error — it is allowed, and often intended — but the grid marks it so the
 * divergence is visible rather than silent.
 */
export function isDrifting(record) {
  if (!record?.due_date || !record?.week_index) return false;
  const derived = weekIndexOf(record.due_date);
  return derived !== null && derived !== clampWeek(record.week_index);
}

/** Group any rows carrying week_index into a 1..20 bucket map. */
export function byWeek(rows = []) {
  const buckets = new Map(WEEKS.map((w) => [w, []]));
  for (const row of rows) {
    buckets.get(clampWeek(row.week_index))?.push(row);
  }
  return buckets;
}
