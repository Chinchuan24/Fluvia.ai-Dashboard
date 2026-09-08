import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { Reveal, CountUp } from "./motion.jsx";
import Empty from "./Empty.jsx";
import { sgd, sgdCompact, percent } from "../lib/format.js";

/**
 * Pipeline against target.
 *
 * The headline is the *committed* figure — closed-won plus open deals
 * weighted by their probability — not the pipeline total. A pipeline total
 * assumes everything closes, which makes it the most flattering number
 * available and the least useful one to plan against. The unweighted total
 * is still shown, just not as the headline.
 *
 * Ramp colours come from --viz-1..4 and are validated; see tokens.css.
 */

const STAGE_LABELS = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const STAGE_FILL = {
  lead: "var(--viz-1)",
  qualified: "var(--viz-2)",
  proposal: "var(--viz-3)",
  won: "var(--viz-4)",
  lost: "var(--viz-lost)",
};

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="notice" style={{ padding: "var(--space-3)" }}>
      <strong>{STAGE_LABELS[row.stage]}</strong>
      <span className="mono">{sgd(row.value)}</span>
      <span className="muted">
        {row.count} deal{row.count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

export default function SalesProgress({ sales }) {
  if (!sales.all.length) {
    return (
      <Reveal className="card">
        <div className="card__head">
          <h2 className="card__title">Sales</h2>
        </div>
        <Empty title="No deals yet">
          Add a client, a value and a stage. Probability drives the committed
          figure, so a deal at 0% counts for nothing until you move it.
        </Empty>
      </Reveal>
    );
  }

  const pct = Math.min(1, sales.againstTarget);

  return (
    <Reveal className="card">
      <div className="card__head">
        <h2 className="card__title">Sales</h2>
        <span className="card__hint">
          {sales.open.length} open · {sales.won.length} won
        </span>
      </div>

      <div className="stack">
        <div className="stats">
          <div className="stat">
            <span className="stat__label">Committed</span>
            <span className="stat__value">
              <CountUp value={sales.committed} format={(n) => sgdCompact(n)} />
            </span>
            <span className="stat__note">won + weighted open</span>
          </div>
          <div className="stat">
            <span className="stat__label">Pipeline</span>
            <span className="stat__value">
              <CountUp value={sales.openValue} format={(n) => sgdCompact(n)} />
            </span>
            <span className="stat__note">unweighted, all open</span>
          </div>
          <div className="stat">
            <span className="stat__label">Retainers</span>
            <span className="stat__value">
              <CountUp value={sales.mrr} format={(n) => sgdCompact(n)} />
            </span>
            <span className="stat__note">monthly, from won</span>
          </div>
          <div className="stat">
            <span className="stat__label">Win rate</span>
            <span className="stat__value">
              {sales.winRate === null ? "—" : percent(sales.winRate)}
            </span>
            <span className="stat__note">
              {sales.winRate === null ? "nothing decided yet" : `${sales.won.length} of ${sales.won.length + sales.lost.length}`}
            </span>
          </div>
        </div>

        <div className="stack" style={{ gap: "var(--space-2)" }}>
          <div className="inline">
            <span className="muted" style={{ fontSize: "var(--step--1)" }}>
              Against {sgdCompact(sales.target)} target
            </span>
            <span className="row__spacer" />
            <span className="mono" style={{ fontSize: "var(--step--1)" }}>
              {percent(sales.againstTarget)}
            </span>
          </div>
          <div
            className="meter"
            role="meter"
            aria-valuenow={Math.round(sales.againstTarget * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Committed revenue against target"
          >
            <div className="meter__fill" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>

        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sales.stages} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis
                dataKey="stage"
                tickFormatter={(s) => STAGE_LABELS[s]}
                stroke="var(--text-3)"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                fontSize={12}
              />
              <YAxis
                tickFormatter={(v) => sgdCompact(v)}
                stroke="var(--text-3)"
                tickLine={false}
                axisLine={false}
                width={60}
                fontSize={12}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {sales.stages.map((row) => (
                  <Cell key={row.stage} fill={STAGE_FILL[row.stage]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {sales.grantFunded ? (
          <p className="muted" style={{ fontSize: "var(--step--1)" }}>
            {sales.grantFunded} deal{sales.grantFunded === 1 ? " is" : "s are"} grant-funded.
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}
