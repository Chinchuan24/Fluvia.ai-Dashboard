/**
 * The ambient background layer. Plain Canvas 2D — no three.js, no WebGL, no
 * animation library. A slow drift of soft points connected where they come
 * close, which is enough to keep the page from feeling like a static
 * screenshot without competing with the data.
 *
 * It respects prefers-reduced-motion by not rendering at all: the layer is
 * decoration, and the honest response to "I don't want movement" is to
 * remove it rather than slow it down.
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

const POINT_COUNT = 46;
const LINK_DISTANCE = 170;
const SPEED = 0.06;

export default function AmbientCanvas() {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return undefined;
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let frame;
    let running = true;
    const points = [];

    // Cap the backing store at 2x. Beyond that the cost is real and the
    // improvement is not visible on a blurred decorative layer.
    const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const scale = dpr();
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * scale);
      canvas.height = Math.floor(height * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    }

    function seed() {
      points.length = 0;
      for (let i = 0; i < POINT_COUNT; i += 1) {
        points.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * SPEED,
          vy: (Math.random() - 0.5) * SPEED,
          r: 0.8 + Math.random() * 1.6,
        });
      }
    }

    function step(delta) {
      for (const p of points) {
        p.x += p.vx * delta;
        p.y += p.vy * delta;
        // Wrap rather than bounce: bouncing makes the edges of the viewport
        // legible, which draws the eye to exactly where nothing is happening.
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;
          const strength = (1 - dist / LINK_DISTANCE) * 0.16;
          ctx.strokeStyle = `rgba(120, 170, 235, ${strength})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const p of points) {
        ctx.fillStyle = "rgba(150, 195, 245, 0.30)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    let last = performance.now();
    function loop(now) {
      if (!running) return;
      // Normalise to 60fps-equivalent steps and clamp, so a backgrounded tab
      // does not resume by teleporting every point across the screen.
      const delta = Math.min((now - last) / 16.67, 3);
      last = now;
      step(delta);
      draw();
      frame = requestAnimationFrame(loop);
    }

    function onResize() {
      resize();
      seed();
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    }

    resize();
    seed();
    frame = requestAnimationFrame(loop);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={ref} className="ambient" aria-hidden="true" />;
}
