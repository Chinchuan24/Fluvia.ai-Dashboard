/**
 * Load, derive, subscribe, refresh.
 *
 * One hook owns the dashboard's data for the whole app. Panels receive
 * derived figures as props and never fetch for themselves, which is what
 * keeps the page to a single round of queries on mount instead of one per
 * module.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readAll, subscribe, isConfigured, configError } from "./db.js";
import { derive } from "./derive.js";

export function useDashboard() {
  const [raw, setRaw] = useState({ tasks: [], milestones: [], deals: [], attendance: [] });
  const [status, setStatus] = useState(isConfigured ? "loading" : "unconfigured");
  const [error, setError] = useState(isConfigured ? null : configError);

  // Rows touched since the last render, so a panel can pulse the one record
  // that changed rather than animating the whole list. Cleared by the
  // component that consumes it.
  const [touched, setTouched] = useState(() => new Set());

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!isConfigured) return;
    if (!quiet) setStatus((prev) => (prev === "ready" ? "refreshing" : "loading"));
    try {
      const next = await readAll();
      if (!mounted.current) return;
      setRaw(next);
      setError(null);
      setStatus("ready");
    } catch (err) {
      if (!mounted.current) return;
      setError(err.message ?? String(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime. A change anywhere refetches everything: the dataset is small,
  // and a whole refetch cannot leave the derived figures disagreeing with the
  // rows the way patching one table in place can.
  useEffect(() => {
    if (!isConfigured) return undefined;
    const stop = subscribe(({ row }) => {
      if (row?.id) {
        setTouched((prev) => new Set(prev).add(row.id));
      }
      refresh({ quiet: true });
    });
    return stop;
  }, [refresh]);

  const data = useMemo(() => derive(raw), [raw]);

  const clearTouched = useCallback(() => setTouched(new Set()), []);

  return {
    raw,
    data,
    status,
    error,
    loading: status === "loading",
    ready: status === "ready" || status === "refreshing",
    touched,
    clearTouched,
    refresh,
  };
}
