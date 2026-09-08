/**
 * Shared motion primitives.
 *
 * Two rules hold everywhere in this app.
 *
 * Transforms are passed to framer-motion as full strings —
 * `transform: "translateY(12px)"` — not the `x` / `y` / `scale` shorthands.
 * The shorthands animate through a path that is not hardware accelerated on
 * every engine, and the dropped frames show up exactly when the page is
 * still loading and least able to absorb them.
 *
 * Data the user is reading does not move for style. Figures count up once on
 * mount and then hold; rows never drift; a record that changes gets a single
 * border pulse rather than animating its own value.
 */

import { useEffect, useReducer, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const EASE_OUT = [0.22, 1, 0.36, 1];

/** Panel entrance. Fades and lifts, once. */
export function Reveal({ children, delay = 0, className, ...rest }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, transform: reduced ? "none" : "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: reduced ? 0.2 : 0.32, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** Stagger a list's entrance without staggering anything inside the rows. */
export function Stagger({ children, className, step = 0.04 }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: reduced ? 0 : step } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, ...rest }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, transform: reduced ? "none" : "translateY(8px)" },
        shown: { opacity: 1, transform: "translateY(0px)" },
      }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Count a figure up once, on mount, then leave it alone.
 *
 * Deliberately not reactive to later changes: if the number updates while
 * someone is reading it, it re-renders to the new value without animating.
 * A figure that rolls every time the realtime channel fires is unreadable.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 900 }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const done = useRef(false);

  useEffect(() => {
    if (reduced || done.current) {
      setDisplay(value);
      return undefined;
    }
    done.current = true;

    const target = Number(value) || 0;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast enough to feel immediate, settles rather than stops.
      setDisplay(target * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDisplay(target);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done.current) setDisplay(value);
  }, [value]);

  return <>{format(display)}</>;
}

/**
 * One 400ms border pulse when `signal` changes. Used for records the
 * realtime channel reports as touched.
 */
export function usePulse(signal) {
  const [, bump] = useReducer((n) => n + 1, 0);
  const [pulsing, setPulsing] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    setPulsing(true);
    bump();
    const timer = setTimeout(() => setPulsing(false), 400);
    return () => clearTimeout(timer);
  }, [signal]);

  return pulsing ? "pulse" : "";
}

export { motion };
