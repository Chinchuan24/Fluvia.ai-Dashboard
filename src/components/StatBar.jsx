import { Reveal, CountUp } from "./motion.jsx";
import { sgdCompact, percent, duration } from "../lib/format.js";

/**
 * The five figures across the top. Each counts up once on mount and then
 * holds — see motion.jsx for why they do not re-animate.
 */
export default function StatBar({ data }) {
  const { tasks, sales, attendance, milestones, week } = data;

  const tiles = [
    {
      label: "Programme",
      value: week ? `W${week}` : "—",
      note: week ? `of 20 weeks` : "outside the programme dates",
      raw: false,
    },
    {
      label: "Work done",
      value: tasks.total ? tasks.completion : 0,
      note: `${tasks.done} of ${tasks.total} tasks`,
      format: (n) => percent(n),
    },
    {
      label: "Committed",
      value: sales.committed,
      note: `${percent(sales.againstTarget)} of ${sgdCompact(sales.target)} target`,
      format: (n) => sgdCompact(n),
    },
    {
      label: "Hours logged",
      value: attendance.totalHours,
      note: attendance.streak ? `${attendance.streak}-day streak` : `${attendance.daysLogged} days`,
      // duration() renders 0 as an em dash, which reads as "nothing logged".
      // Correct for a single day's row, wrong for a running total: during the
      // count-up the figure passes through zero, and for ~900ms the headline
      // would claim no hours exist at all.
      format: (n) => (n > 0 ? duration(n) : "0h"),
    },
    {
      label: "Milestones",
      value: milestones.achieved,
      note: `${milestones.pending} still open`,
      format: (n) => String(Math.round(n)),
    },
  ];

  return (
    <Reveal className="card">
      <div className="stats">
        {tiles.map((tile) => (
          <div className="stat" key={tile.label}>
            <span className="stat__label">{tile.label}</span>
            <span className="stat__value">
              {tile.format ? <CountUp value={tile.value} format={tile.format} /> : tile.value}
            </span>
            <span className="stat__note">{tile.note}</span>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
