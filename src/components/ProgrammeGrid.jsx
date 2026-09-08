import { useState } from "react";
import { Reveal } from "./motion.jsx";
import Empty from "./Empty.jsx";
import { weekRangeLabel } from "../lib/weeks.js";
import { shortDate } from "../lib/format.js";

/**
 * The twenty-week programme grid.
 *
 * Bar height is the task count for that week, scaled against the busiest
 * week rather than each column scaling to itself — otherwise a week with one
 * task looks as full as a week with nine.
 *
 * Selecting a week is a filter, not a navigation: it reveals that week's
 * detail below without moving anything else on the page.
 */
export default function ProgrammeGrid({ programme, canEdit, onMoveTask }) {
  const [selected, setSelected] = useState(null);
  const { weeks, peak, current } = programme;

  const active = selected ? weeks.find((w) => w.index === selected) : null;

  if (!peak) {
    return (
      <Reveal className="card">
        <div className="card__head">
          <h2 className="card__title">Twenty-week programme</h2>
        </div>
        <Empty title="No work scheduled yet">
          Add tasks with a week between 1 and 20 and they will stack up here,
          one column per week.
        </Empty>
      </Reveal>
    );
  }

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Twenty-week programme</h2>
        <span className="card__hint">
          {current ? `Week ${current} · ${weekRangeLabel(current)}` : "Outside the programme dates"}
        </span>
      </div>

      <div className="grid-scroll">
        <div className="weeks" role="list">
          {weeks.map((week) => {
            const height = peak ? Math.round((week.total / peak) * 100) : 0;
            const allDone = week.total > 0 && week.done === week.total;
            const barClass = week.blocked
              ? "week__bar week__bar--blocked"
              : allDone
                ? "week__bar week__bar--done"
                : "week__bar";

            return (
              <button
                type="button"
                role="listitem"
                key={week.index}
                className={`week${week.isCurrent ? " week--current" : ""}${week.isPast ? " week--past" : ""}`}
                aria-pressed={selected === week.index}
                onClick={() => setSelected(selected === week.index ? null : week.index)}
                title={`Week ${week.index} · ${week.range} · ${week.total} task${week.total === 1 ? "" : "s"}${week.blocked ? `, ${week.blocked} blocked` : ""}`}
              >
                <span className="week__track">
                  <span
                    className={barClass}
                    style={{ height: `${Math.max(week.total ? 6 : 0, height)}%` }}
                  />
                </span>
                {week.milestones.length ? <span className="week__dot" /> : <span style={{ height: 6 }} />}
                <span className="week__label">{week.index}</span>
              </button>
            );
          })}
        </div>
      </div>

      {active ? (
        <div className="stack" style={{ marginTop: "var(--space-5)" }}>
          <div className="inline">
            <strong>Week {active.index}</strong>
            <span className="muted">{active.range}</span>
            <span className="chip">
              {active.done}/{active.total} done
            </span>
            {active.blocked ? <span className="chip chip--warn">{active.blocked} blocked</span> : null}
          </div>

          {active.tasks.length ? (
            <div className="list">
              {active.tasks.map((task) => (
                <div className="row" key={task.id}>
                  <span className={`dot dot--${task.status}`} />
                  <span className="sr-only">{task.status}</span>
                  <span className="row__title">{task.title}</span>
                  <span className="row__spacer" />
                  {task.due_date ? <span className="row__meta">due {shortDate(task.due_date)}</span> : null}
                  {canEdit ? (
                    <span className="inline">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={active.index <= 1}
                        onClick={() => onMoveTask?.(task.id, active.index - 1)}
                        aria-label={`Move ${task.title} one week earlier`}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={active.index >= 20}
                        onClick={() => onMoveTask?.(task.id, active.index + 1)}
                        aria-label={`Move ${task.title} one week later`}
                      >
                        →
                      </button>
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Nothing scheduled in this week" />
          )}

          {canEdit ? (
            <p className="muted" style={{ fontSize: "var(--step--1)" }}>
              Moving a task changes its week on the plan. Its due date does not
              move — that is deliberate, so replanning never quietly changes
              what you committed to.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: "var(--space-4)", fontSize: "var(--step--1)" }}>
          Select a week to see what is in it.
        </p>
      )}
    </Reveal>
  );
}
