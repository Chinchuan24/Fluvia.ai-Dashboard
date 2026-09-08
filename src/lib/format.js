/**
 * Formatting, and the date rule the whole app depends on.
 *
 * The business runs on Singapore time. Every calendar day in this app — an
 * attendance row, a due date, "today" — means a day in SGT, regardless of
 * where the browser happens to be. So the timezone is pinned here rather
 * than left to the machine.
 */

export const TZ = "Asia/Singapore";
const LOCALE = "en-SG";

/**
 * The calendar-day key: "2026-03-14".
 *
 * Never use `toISOString().slice(0, 10)` for this. `toISOString` converts to
 * UTC first, so midnight in Singapore (UTC+8) serialises back as 16:00 on the
 * *previous* day, and every attendance cell silently reads the wrong record.
 * The bug is invisible for most of the day and appears in the small hours,
 * which is the worst way for a bug to behave.
 *
 * `en-CA` is used only because it formats as YYYY-MM-DD; the timezone is what
 * matters here.
 */
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function ymd(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dayKeyFormat.format(date);
}

/** Today, as a day key, in SGT. */
export function today() {
  return ymd(new Date());
}

/**
 * Parse a day key back into a Date at midnight SGT.
 * SGT is UTC+8 year-round — no daylight saving — so the offset is a constant
 * and this needs no timezone library.
 */
export function fromYmd(key) {
  if (!key) return null;
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d) - 8 * 60 * 60 * 1000);
}

/**
 * Step a day key by whole days: shiftDayKey("2026-03-01", -1) -> "2026-02-28".
 *
 * Pure calendar arithmetic on the key itself, so it never touches a timezone
 * and cannot drift the way a Date round-trip can.
 */
export function shiftDayKey(key, delta) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return null;
  const stepped = new Date(Date.UTC(y, m - 1, d + delta));
  const yyyy = String(stepped.getUTCFullYear()).padStart(4, "0");
  const mm = String(stepped.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(stepped.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Whole days between two day keys, b - a. */
export function daysBetween(a, b) {
  const from = fromYmd(a);
  const to = fromYmd(b);
  if (!from || !to) return null;
  return Math.round((to - from) / 86_400_000);
}

// --- Money ------------------------------------------------------------------

/**
 * "S$" is written by hand, not by Intl.
 *
 * Every locale collapses SGD to something unhelpful: en-SG gives a bare "$"
 * (it is the local currency, so it assumes no ambiguity), en-US gives "SGD
 * 12,000". A bare "$" is genuinely ambiguous on a dashboard that quotes
 * clients in more than one dollar, so the number is formatted on its own and
 * the symbol prefixed.
 */
const money = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});

const moneyCents = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function withSymbol(formatter, value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe < 0 ? `-S$${formatter.format(-safe)}` : `S$${formatter.format(safe)}`;
}

/** S$12,000 — whole dollars, which is the right precision for a pipeline. */
export function sgd(value) {
  return withSymbol(money, value);
}

export function sgdExact(value) {
  return withSymbol(moneyCents, value);
}

/** S$1.2M / S$48k — for figures that have to fit in a tile. */
export function sgdCompact(value) {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}S$${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}S$${trim(abs / 1_000)}k`;
  return `${sign}S$${Math.round(abs)}`;
}

function trim(n) {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function percent(value, digits = 0) {
  const n = Number(value);
  return `${(Number.isFinite(n) ? n * 100 : 0).toFixed(digits)}%`;
}

// --- Clock and dates --------------------------------------------------------

const clock = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const clockSeconds = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** 09:42 in Singapore, whatever the viewer's machine thinks the time is. */
export function sgtTime(value = new Date(), withSeconds = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (withSeconds ? clockSeconds : clock).format(date);
}

const dayLabel = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  day: "numeric",
  month: "short",
});

const dayLabelLong = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "14 Mar" — accepts a Date or a day key. */
export function shortDate(value) {
  const date = typeof value === "string" ? fromYmd(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return dayLabel.format(date);
}

export function longDate(value) {
  const date = typeof value === "string" ? fromYmd(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return dayLabelLong.format(date);
}

/** Hours as "7h 30m". */
export function duration(hours) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const whole = Math.floor(n);
  const minutes = Math.round((n - whole) * 60);
  if (!whole) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}
