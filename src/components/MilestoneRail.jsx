import { Reveal, Stagger, StaggerItem } from "./motion.jsx";
import Empty from "./Empty.jsx";
import { shortDate, daysBetween, today } from "../lib/format.js";

export default function MilestoneRail({ milestones, canEdit, onToggle, touched }) {
  const now = today();

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Milestones</h2>
        <span className="card__hint">
          {milestones.achieved}/{milestones.all.length} reached
        </span>
      </div>

      {milestones.all.length ? (
        <Stagger className="list">
          {milestones.all.map((milestone) => {
            const late =
              !milestone.achieved_at &&
              milestone.target_date &&
              daysBetween(milestone.target_date, now) > 0;

            return (
              <StaggerItem
                key={milestone.id}
                className={`row${touched?.has(milestone.id) ? " pulse" : ""}`}
              >
                <span className={`dot dot--${milestone.achieved_at ? "done" : late ? "overdue" : "todo"}`} />
                <span className="sr-only">
                  {milestone.achieved_at ? "reached" : late ? "overdue" : "pending"}
                </span>

                <span className="stack" style={{ gap: 2 }}>
                  <span className="row__title">{milestone.title}</span>
                  <span className="row__meta">
                    W{milestone.week_index}
                    {milestone.target_date ? ` · target ${shortDate(milestone.target_date)}` : ""}
                    {milestone.achieved_at ? ` · reached ${shortDate(milestone.achieved_at)}` : ""}
                  </span>
                </span>

                <span className="row__spacer" />
                {late ? <span className="chip chip--alert">overdue</span> : null}

                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onToggle?.(milestone.id, milestone.achieved_at ? null : now)}
                  >
                    {milestone.achieved_at ? "Undo" : "Mark reached"}
                  </button>
                ) : null}
              </StaggerItem>
            );
          })}
        </Stagger>
      ) : (
        <Empty title="No milestones yet">
          Milestones mark the handful of dates that matter. Give each one a
          title and the week it belongs to.
        </Empty>
      )}
    </Reveal>
  );
}
