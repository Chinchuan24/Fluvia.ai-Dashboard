/**
 * Colour checks for the data-visualisation palette.
 *
 * The chart colours are not chosen by eye. Each one has to clear five bars,
 * and this script is what says whether it does. Run it after changing any
 * value in the --viz-* or --attend-* tokens:
 *
 *   node scripts/check-palette.mjs
 *
 *   1. Lightness band      L within [0.55, 0.85] — bright enough to read on
 *                          the dark surface, not so bright it blooms.
 *   2. Chroma floor        C >= 0.08 — below this hues stop being nameable
 *                          and the ramp reads as grey.
 *   3. Colour-blind        Adjacent steps stay >= 0.06 apart in OKLab after
 *      separation          Machado-2009 protanopia and deuteranopia at full
 *                          severity. This is the one that fails first.
 *   4. Normal-vision floor Adjacent steps >= 0.10 apart unsimulated.
 *   5. WCAG contrast       >= 3.0:1 against the panel surface, the
 *                          non-text minimum for a meaningful graphic.
 */

// --- OKLCH -> linear sRGB -> sRGB -------------------------------------------

function oklchToOklab({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  return { L: l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
}

function oklabToLinearSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function linearSrgbToOklab({ r, g, b }) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function hex({ r, g, b }) {
  const to = (v) => Math.round(clamp01(encode(v)) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** True when the colour needs clipping to fit sRGB — it will not display as specified. */
function outOfGamut({ r, g, b }) {
  const eps = 0.0005;
  return [r, g, b].some((v) => v < -eps || v > 1 + eps);
}

// --- Vision simulation (Machado, Oliveira & Fernandes 2009, severity 1.0) ---

const MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function simulate(rgb, kind) {
  const m = MATRICES[kind];
  const v = [rgb.r, rgb.g, rgb.b];
  return {
    r: m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    g: m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    b: m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  };
}

// --- Metrics ----------------------------------------------------------------

function luminance({ r, g, b }) {
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function deltaE(a, b) {
  const x = linearSrgbToOklab(a);
  const y = linearSrgbToOklab(b);
  return Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
}

// --- The palette under test -------------------------------------------------

const parse = (s) => {
  const [l, c, h] = s.split(" ").map(Number);
  return { l, c, h };
};

const SURFACE = parse("0.18 0.018 250"); // --surface-1, what charts sit on

const RAMPS = {
  "funnel ramp (--viz-1..4)": [
    ["lead", "0.62 0.105 250"],
    ["qualified", "0.70 0.118 215"],
    ["proposal", "0.78 0.142 175"],
    ["won", "0.84 0.170 145"],
  ],
  "attendance fills (--attend-1..4)": [
    ["none", "0.58 0.090 285"],
    ["partial", "0.68 0.140 320"],
    ["full", "0.76 0.150 75"],
    ["over", "0.70 0.170 30"],
  ],
  "status (amber / red)": [
    ["blocked (amber)", "0.80 0.150 80"],
    ["overdue (red)", "0.64 0.190 25"],
  ],
};

const BANDS = { lMin: 0.55, lMax: 0.85, cMin: 0.08, cbdSep: 0.06, sep: 0.1, contrast: 3.0 };

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.log(`   FAIL  ${msg}`);
};

const surfaceRgb = oklabToLinearSrgb(oklchToOklab(SURFACE));
console.log(`surface  oklch(${SURFACE.l} ${SURFACE.c} ${SURFACE.h})  ${hex(surfaceRgb)}\n`);

for (const [name, entries] of Object.entries(RAMPS)) {
  console.log(name);
  const swatches = entries.map(([label, spec]) => {
    const lch = parse(spec);
    const rgb = oklabToLinearSrgb(oklchToOklab(lch));
    return { label, lch, rgb };
  });

  for (const s of swatches) {
    const ratio = contrast(s.rgb, surfaceRgb);
    console.log(
      `   ${s.label.padEnd(16)} ${hex(s.rgb).padEnd(8)} L=${s.lch.l.toFixed(2)} C=${s.lch.c.toFixed(3)} contrast=${ratio.toFixed(2)}:1`,
    );
    if (outOfGamut(s.rgb)) fail(`${s.label} is outside sRGB and will be clipped`);
    if (s.lch.l < BANDS.lMin || s.lch.l > BANDS.lMax)
      fail(`${s.label} L=${s.lch.l} outside [${BANDS.lMin}, ${BANDS.lMax}]`);
    if (s.lch.c < BANDS.cMin) fail(`${s.label} C=${s.lch.c} below chroma floor ${BANDS.cMin}`);
    if (ratio < BANDS.contrast)
      fail(`${s.label} contrast ${ratio.toFixed(2)}:1 below ${BANDS.contrast}:1`);
  }

  for (let i = 1; i < swatches.length; i += 1) {
    const a = swatches[i - 1];
    const b = swatches[i];
    const normal = deltaE(a.rgb, b.rgb);
    const protan = deltaE(simulate(a.rgb, "protan"), simulate(b.rgb, "protan"));
    const deutan = deltaE(simulate(a.rgb, "deutan"), simulate(b.rgb, "deutan"));
    console.log(
      `   ${a.label} -> ${b.label}: normal ${normal.toFixed(3)}  protan ${protan.toFixed(3)}  deutan ${deutan.toFixed(3)}`,
    );
    if (normal < BANDS.sep) fail(`${a.label}/${b.label} only ${normal.toFixed(3)} apart in normal vision`);
    if (protan < BANDS.cbdSep) fail(`${a.label}/${b.label} collapses under protanopia (${protan.toFixed(3)})`);
    if (deutan < BANDS.cbdSep) fail(`${a.label}/${b.label} collapses under deuteranopia (${deutan.toFixed(3)})`);
  }
  console.log("");
}

console.log(failures ? `${failures} check(s) failed.` : "All checks passed.");
process.exit(failures ? 1 : 0);
