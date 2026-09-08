/**
 * Fabricated sample data. Every client, figure and date here is invented —
 * it exists so the dashboard can be looked at with something in it, and it
 * is not anybody's real pipeline.
 *
 * Loaded by `npm run seed`. Safe to delete once you have real rows.
 */

import { weekStart } from "../lib/weeks.js";
import { shiftDayKey } from "../lib/format.js";

const day = (week, offset = 0) => shiftDayKey(weekStart(week), offset);

export const tasks = [
  { title: "Discovery workshop — Meridian Logistics", workstream: "delivery", status: "done", week_index: 1, due_date: day(1, 3) },
  { title: "Data audit and access review", workstream: "delivery", status: "done", week_index: 2, due_date: day(2, 2) },
  { title: "Draft integration architecture", workstream: "delivery", status: "doing", week_index: 3, due_date: day(3, 4) },
  { title: "Pilot scope sign-off", workstream: "delivery", status: "blocked", week_index: 3, due_date: day(3, 1) },
  { title: "Vendor security questionnaire", workstream: "ops", status: "todo", week_index: 4, due_date: day(4, 2) },
  { title: "Case study write-up", workstream: "marketing", status: "todo", week_index: 5, due_date: day(5, 4) },
  { title: "IMDA grant application", workstream: "ops", status: "doing", week_index: 4, due_date: day(4, 0) },
  { title: "Retainer proposal — Kallang Foods", workstream: "sales", status: "todo", week_index: 6, due_date: day(6, 2) },
  { title: "Model evaluation harness", workstream: "delivery", status: "todo", week_index: 7, due_date: day(7, 3) },
  { title: "Quarterly finance review", workstream: "ops", status: "todo", week_index: 9, due_date: day(9, 4) },
];

export const milestones = [
  { title: "First pilot signed", week_index: 2, target_date: day(2, 4), achieved_at: day(2, 3) },
  { title: "Integration live in staging", week_index: 6, target_date: day(6, 4), achieved_at: null },
  { title: "First retainer client", week_index: 10, target_date: day(10, 4), achieved_at: null },
  { title: "Grant decision received", week_index: 12, target_date: day(12, 2), achieved_at: null },
  { title: "Programme review", week_index: 20, target_date: day(20, 4), achieved_at: null },
];

export const deals = [
  { client: "Meridian Logistics", contact: "ops@meridian.example", stage: "won", value_sgd: 48000, retainer_sgd: 4000, probability: 1, grant_funded: false },
  { client: "Kallang Foods", contact: "cto@kallangfoods.example", stage: "proposal", value_sgd: 65000, retainer_sgd: 5000, probability: 0.6, grant_funded: true },
  { client: "Tanjong Marine", contact: "hello@tanjongmarine.example", stage: "qualified", value_sgd: 90000, retainer_sgd: 0, probability: 0.35, grant_funded: false },
  { client: "Bukit Health Group", contact: "it@bukithealth.example", stage: "lead", value_sgd: 120000, retainer_sgd: 8000, probability: 0.15, grant_funded: true },
  { client: "Sembawang Rail", contact: "procurement@sembrail.example", stage: "lost", value_sgd: 40000, retainer_sgd: 0, probability: 0, grant_funded: false },
];

/** Twenty-eight days back from week 1, with a couple of gaps so the grid is not uniform. */
export const attendance = Array.from({ length: 28 }, (_, i) => {
  const dayKey = shiftDayKey(weekStart(1), i);
  const weekday = i % 7;
  if (weekday === 5 || weekday === 6) return null;      // weekends off
  if (i === 9 || i === 17) return null;                 // two days away
  const hours = [7.5, 8, 8.25, 6.5, 9, 8.75, 7][i % 7];
  return {
    day_key: dayKey,
    clock_in: `${dayKey}T01:00:00.000Z`,                // 09:00 SGT
    clock_out: `${dayKey}T${String(Math.floor(1 + hours)).padStart(2, "0")}:00:00.000Z`,
    hours,
    note: null,
  };
}).filter(Boolean);
