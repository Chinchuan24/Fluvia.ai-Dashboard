import { useMemo, useState } from "react";
import { Reveal, Stagger, StaggerItem } from "./motion.jsx";
import Empty from "./Empty.jsx";
import { shortDate, daysBetween, today } from "../lib/format.js";
import { isDrifting } from "../lib/weeks.js";

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
  { id: "blocked", label: "Blocked" },
  { id: "overdue", label: "Overdue" },
];

const NEXT_STATUS = { todo: "doing", doing: "done", done: "todo", blocked: "doing" };

export default function WorkList({ tasks, canEdit, onSetStatus, onRemove, touched }) {
  const [filter, setFilter] = useState("open");
  const now = today();

  const rows = useMemo(() => {
    const all = tasks.all;
    if (filter === "all") return all;
    if (filter === "blocked") return all.filter((t) => t.status === "blocked");
    if (filter === "overdue") return tasks.overdue;
    return all.filter((t) => t.status !== "done");
  }, [tasks, filter]);

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Work</h2>
        <span className="card__hint">
          {tasks.done}/{tasks.total} done
        </span>
      </div>

      <div className="inline" style={{ marginBottom: "var(--space-4)" }}>
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${filter === option.id ? " chip--edit" : ""}`}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rows.length ? (
        <Stagger className="list">
          {rows.map((task) => {
            const late = task.status !== "done" && task.due_date && daysBetween(task.due_date, now) > 0;
            const drift = isDrifting(task);
            return (
              <StaggerItem
                key={task.id}
                className={`row${touched?.has(task.id) ? " pulse" : ""}`}
              >
                <span className={`dot dot--${late ? "overdue" : task.status}`} />
                <span className="sr-only">{late ? "overdue" : task.status}</span>

                <span className="stack" style={{ gap: 2 }}>
                  <span className="row__title">{task.title}</span>
                  <span className="row__meta">
                    {task.workstream} · W{task.week_index}
                    {task.due_date ? ` · due ${shortDate(task.due_date)}` : ""}
                    {drift ? " · plan and deadline differ" : ""}
                  </span>
                </span>

                <span className="row__spacer" />

                {late ? <span className="chip chip--alert">overdue</span> : null}

                {canEdit ? (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => onSetStatus?.(task.id, NEXT_STATUS[task.status] ?? "doing")}
                    >
                      {task.status === "done" ? "Reopen" : task.status === "doing" ? "Finish" : "Start"}
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => onRemove?.(task.id, task.title)}
                      aria-label={`Delete ${task.title}`}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </StaggerItem>
            );
          })}
        </Stagger>
      ) : (
        <Empty title={filter === "open" ? "No open work" : "Nothing matches this filter"}>
          {tasks.total
            ? "Try another filter."
            : "Add a task with a title, a workstream and a week between 1 and 20."}
        </Empty>
      )}
    </Reveal>
  );
}
