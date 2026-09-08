/**
 * The owner's view: the same modules as the dashboard, with editing on.
 *
 * The redirect below is a courtesy, not a lock. It stops a signed-out
 * visitor landing on a page of buttons that would all fail; it does not stop
 * anyone reaching this code, because the bundle is public. Every write here
 * goes through write.* in db.js and is checked by row-level security in
 * Postgres, which is the part that actually refuses. See ACCESS.md.
 */

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useDashboard } from "../lib/useDashboard.js";
import { useAuth } from "../lib/auth.jsx";
import { write } from "../lib/db.js";
import { today } from "../lib/format.js";
import { defaultWeekFor, TOTAL_WEEKS } from "../lib/weeks.js";
import StatBar from "../components/StatBar.jsx";
import ProgrammeGrid from "../components/ProgrammeGrid.jsx";
import WorkList from "../components/WorkList.jsx";
import SalesProgress from "../components/SalesProgress.jsx";
import Attendance from "../components/Attendance.jsx";
import MilestoneRail from "../components/MilestoneRail.jsx";
import { Reveal } from "../components/motion.jsx";

export default function Admin() {
  const { data, status, error, touched, refresh } = useDashboard();
  const { session, canEdit, loading } = useAuth();
  const [problem, setProblem] = useState(null);

  if (loading) return <p className="muted">Checking…</p>;
  if (!session) return <Navigate to="/login" replace />;
  if (!canEdit) {
    return (
      <Reveal className="notice notice--warn">
        <strong>Signed in, but not an owner.</strong>
        <span>
          This account is not on the owner list, so the server will refuse any
          change it makes. Add the address to owner_emails() in
          supabase/schema.sql and to VITE_OWNER_EMAILS, then sign in again.
        </span>
      </Reveal>
    );
  }

  /** Every mutation on this page funnels through here, so one place reports failure. */
  async function run(action) {
    setProblem(null);
    try {
      await action();
      await refresh({ quiet: true });
    } catch (err) {
      setProblem(err.message ?? String(err));
    }
  }

  if (status === "unconfigured" || status === "error") {
    return (
      <Reveal className="notice notice--alert">
        <strong>Could not load the dashboard.</strong>
        <span>{error}</span>
      </Reveal>
    );
  }

  return (
    <>
      {problem ? (
        <Reveal className="notice notice--alert">
          <strong>That change did not go through.</strong>
          <span>{problem}</span>
        </Reveal>
      ) : null}

      <StatBar data={data} />

      <NewTask onCreate={(row) => run(() => write.tasks.create(row))} />

      <ProgrammeGrid
        programme={data.programme}
        canEdit
        onMoveTask={(id, week) => run(() => write.tasks.moveToWeek(id, week))}
      />

      <div className="cols-2">
        <WorkList
          tasks={data.tasks}
          canEdit
          touched={touched}
          onSetStatus={(id, status_) => run(() => write.tasks.setStatus(id, status_))}
          onRemove={(id, title) => {
            if (window.confirm(`Delete "${title}"? This cannot be undone.`)) {
              run(() => write.tasks.remove(id));
            }
          }}
        />
        <SalesProgress sales={data.sales} />
      </div>

      <NewDeal onCreate={(row) => run(() => write.deals.create(row))} />

      <div className="cols-2">
        <Attendance
          attendance={data.attendance}
          canEdit
          touched={touched}
          onClockIn={() =>
            run(() => write.attendance.upsertDay(today(), { clock_in: new Date().toISOString() }))
          }
          onClockOut={() =>
            run(() => {
              const row = data.attendance.todayRow;
              const startedAt = row?.clock_in ? new Date(row.clock_in) : new Date();
              const endedAt = new Date();
              const hours = Math.max(0, (endedAt - startedAt) / 3_600_000);
              return write.attendance.upsertDay(today(), {
                clock_out: endedAt.toISOString(),
                hours: Number(hours.toFixed(2)),
              });
            })
          }
        />
        <MilestoneRail
          milestones={data.milestones}
          canEdit
          touched={touched}
          onToggle={(id, dayKey) => run(() => write.milestones.setAchieved(id, dayKey))}
        />
      </div>

      <NewMilestone onCreate={(row) => run(() => write.milestones.create(row))} />
    </>
  );
}

/* --- Creation forms -------------------------------------------------------
   Each resets itself on success. week_index is seeded from the due date via
   defaultWeekFor(), and then left alone: the two are allowed to diverge
   afterwards, which is the whole point of storing the week separately. */

function NewTask({ onCreate }) {
  const [title, setTitle] = useState("");
  const [workstream, setWorkstream] = useState("delivery");
  const [due, setDue] = useState(today());
  const [week, setWeek] = useState(() => defaultWeekFor(today()));

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Add work</h2>
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onCreate({
            title: title.trim(),
            workstream: workstream.trim() || "delivery",
            due_date: due || null,
            week_index: Number(week),
            status: "todo",
          });
          setTitle("");
        }}
      >
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="task-title">Title</label>
            <input id="task-title" className="input" value={title} required
              onChange={(e) => setTitle(e.target.value)} placeholder="Scope the pilot" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="task-ws">Workstream</label>
            <input id="task-ws" className="input" value={workstream}
              onChange={(e) => setWorkstream(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="task-due">Due</label>
            <input id="task-due" className="input" type="date" value={due ?? ""}
              onChange={(e) => {
                setDue(e.target.value);
                if (e.target.value) setWeek(defaultWeekFor(e.target.value));
              }} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="task-week">Week</label>
            <select id="task-week" className="select" value={week}
              onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn--primary">Add task</button>
        </div>
      </form>
    </Reveal>
  );
}

function NewDeal({ onCreate }) {
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [retainer, setRetainer] = useState("");
  const [stage, setStage] = useState("lead");
  const [probability, setProbability] = useState("20");
  const [grant, setGrant] = useState(false);

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Add deal</h2>
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!client.trim()) return;
          onCreate({
            client: client.trim(),
            stage,
            value_sgd: Number(value) || 0,
            retainer_sgd: Number(retainer) || 0,
            probability: Math.min(1, Math.max(0, Number(probability) / 100)),
            grant_funded: grant,
          });
          setClient("");
          setValue("");
          setRetainer("");
        }}
      >
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="deal-client">Client</label>
            <input id="deal-client" className="input" value={client} required
              onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="deal-value">Value (S$)</label>
            <input id="deal-value" className="input" type="number" min="0" step="100"
              value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="deal-retainer">Retainer (S$/mo)</label>
            <input id="deal-retainer" className="input" type="number" min="0" step="100"
              value={retainer} onChange={(e) => setRetainer(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="deal-stage">Stage</label>
            <select id="deal-stage" className="select" value={stage}
              onChange={(e) => setStage(e.target.value)}>
              {["lead", "qualified", "proposal", "won", "lost"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="deal-prob">Probability (%)</label>
            <input id="deal-prob" className="input" type="number" min="0" max="100" step="5"
              value={probability} onChange={(e) => setProbability(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="deal-grant">Grant-funded</label>
            <input id="deal-grant" type="checkbox" checked={grant}
              onChange={(e) => setGrant(e.target.checked)} style={{ width: 18, height: 18 }} />
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn--primary">Add deal</button>
        </div>
      </form>
    </Reveal>
  );
}

function NewMilestone({ onCreate }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(today());
  const [week, setWeek] = useState(() => defaultWeekFor(today()));

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Add milestone</h2>
      </div>
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim()) return;
          onCreate({
            title: title.trim(),
            target_date: target || null,
            week_index: Number(week),
          });
          setTitle("");
        }}
      >
        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="ms-title">Title</label>
            <input id="ms-title" className="input" value={title} required
              onChange={(e) => setTitle(e.target.value)} placeholder="First retainer signed" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ms-target">Target date</label>
            <input id="ms-target" className="input" type="date" value={target ?? ""}
              onChange={(e) => {
                setTarget(e.target.value);
                if (e.target.value) setWeek(defaultWeekFor(e.target.value));
              }} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ms-week">Week</label>
            <select id="ms-week" className="select" value={week}
              onChange={(e) => setWeek(Number(e.target.value))}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn--primary">Add milestone</button>
        </div>
      </form>
    </Reveal>
  );
}
