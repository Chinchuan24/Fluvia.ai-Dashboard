import { Reveal, CountUp } from "./motion.jsx";
import Empty from "./Empty.jsx";
import { sgtTime, duration, shortDate, today, longDate } from "../lib/format.js";
import { STANDARD_DAY_HOURS } from "../lib/derive.js";

/**
 * Personal attendance.
 *
 * Every cell is one calendar day in SGT, keyed with ymd(). The fill steps
 * come from --attend-1..4 and are validated for colour-blind separation
 * (tokens.css), but colour is never the only carrier: each cell has an
 * accessible label with the actual hours.
 */

function level(hours) {
  const n = Number(hours ?? 0);
  if (n <= 0) return 0;
  if (n < STANDARD_DAY_HOURS * 0.5) return 1;
  if (n < STANDARD_DAY_HOURS * 0.9) return 2;
  if (n <= STANDARD_DAY_HOURS * 1.15) return 3;
  return 4;
}

export default function Attendance({ attendance, canEdit, onClockIn, onClockOut, touched }) {
  const now = today();
  const row = attendance.todayRow;

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Attendance</h2>
        <span className="card__hint">{longDate(now)}</span>
      </div>

      <div className="stack">
        <div className="stats">
          <div className="stat">
            <span className="stat__label">Total</span>
            <span className="stat__value">
              <CountUp value={attendance.totalHours} format={(n) => duration(n)} />
            </span>
            <span className="stat__note">{attendance.daysLogged} days logged</span>
          </div>
          <div className="stat">
            <span className="stat__label">Average day</span>
            <span className="stat__value">{duration(attendance.averageHours)}</span>
            <span className="stat__note">across logged days</span>
          </div>
          <div className="stat">
            <span className="stat__label">Streak</span>
            <span className="stat__value">{attendance.streak}</span>
            <span className="stat__note">consecutive days</span>
          </div>
        </div>

        {canEdit ? (
          <div className="inline">
            {attendance.isClockedIn ? (
              <>
                <span className="chip chip--edit">
                  In since {sgtTime(row.clock_in)}
                </span>
                <button type="button" className="btn btn--primary" onClick={onClockOut}>
                  Clock out
                </button>
              </>
            ) : (
              <>
                <span className="chip">
                  {row?.hours ? `${duration(row.hours)} logged today` : "Not clocked in"}
                </span>
                <button type="button" className="btn btn--primary" onClick={onClockIn}>
                  Clock in
                </button>
              </>
            )}
          </div>
        ) : null}

        {attendance.all.length ? (
          <>
            <div className="attend">
              {attendance.recent
                .slice()
                .reverse()
                .map((entry) => (
                  <span
                    key={entry.day_key}
                    className={`attend__cell attend__cell--${level(entry.hours)}${entry.day_key === now ? " attend__cell--today" : ""}${touched?.has(entry.id) ? " pulse" : ""}`}
                    title={`${shortDate(entry.day_key)} · ${duration(entry.hours)}`}
                    role="img"
                    aria-label={`${shortDate(entry.day_key)}: ${duration(entry.hours)}`}
                  />
                ))}
            </div>
            <p className="muted" style={{ fontSize: "var(--step--1)" }}>
              Last {attendance.recent.length} logged day
              {attendance.recent.length === 1 ? "" : "s"}, oldest first.
            </p>
          </>
        ) : (
          <Empty title="Nothing logged yet">
            {canEdit
              ? "Clock in and the day appears here. One row per calendar day, Singapore time."
              : "Days appear here once the owner starts logging them."}
          </Empty>
        )}
      </div>
    </Reveal>
  );
}
