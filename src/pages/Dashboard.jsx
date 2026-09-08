/**
 * The read-only view. Anyone can open it; nothing here mutates.
 *
 * Admin renders the same modules with `canEdit` on, so the two pages cannot
 * drift apart in what they show — only in what they let you do.
 */

import { useDashboard } from "../lib/useDashboard.js";
import { useCanEdit } from "../lib/auth.jsx";
import StatBar from "../components/StatBar.jsx";
import ProgrammeGrid from "../components/ProgrammeGrid.jsx";
import WorkList from "../components/WorkList.jsx";
import SalesProgress from "../components/SalesProgress.jsx";
import Attendance from "../components/Attendance.jsx";
import MilestoneRail from "../components/MilestoneRail.jsx";
import { Reveal } from "../components/motion.jsx";

export default function Dashboard() {
  const { data, status, error, touched } = useDashboard();
  const canEdit = useCanEdit();

  if (status === "unconfigured") {
    return (
      <Reveal className="notice notice--warn">
        <strong>Supabase is not configured.</strong>
        <span>{error}</span>
        <span className="muted">
          The three values are listed in .env.example. In production they come
          from the host's environment variables, and the build inlines them —
          so a value added after a build needs a redeploy to appear.
        </span>
      </Reveal>
    );
  }

  if (status === "error") {
    return (
      <Reveal className="notice notice--alert">
        <strong>Could not load the dashboard.</strong>
        <span>{error}</span>
        <span className="muted">
          If this mentions row-level security, supabase/schema.sql has not been
          run against this project yet.
        </span>
      </Reveal>
    );
  }

  if (status === "loading") {
    return <p className="muted">Loading…</p>;
  }

  return (
    <>
      <StatBar data={data} />
      <ProgrammeGrid programme={data.programme} canEdit={false} />
      <div className="cols-2">
        <WorkList tasks={data.tasks} canEdit={false} touched={touched} />
        <SalesProgress sales={data.sales} />
      </div>
      <div className="cols-2">
        <Attendance attendance={data.attendance} canEdit={false} touched={touched} />
        <MilestoneRail milestones={data.milestones} canEdit={false} touched={touched} />
      </div>

      {!canEdit ? (
        <p className="muted" style={{ fontSize: "var(--step--1)", textAlign: "center" }}>
          Viewing only. Sign in as an owner to edit.
        </p>
      ) : null}
    </>
  );
}
