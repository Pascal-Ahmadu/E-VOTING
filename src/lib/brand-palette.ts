/**
 * Pure colour maths for the brand ramp. Deliberately free of any database or
 * server-only import so the admin settings page can render a live preview on
 * the client using exactly the same code the server uses to emit the CSS.
 */

export const DEFAULT_BRAND_COLOR = "#198a44";

/** Ramp steps, and how far each is mixed toward white (positive) or black
 * (negative) from the seed. Tuned so a mid-tone seed reproduces a ramp close to
 * the original hand-picked green. */
const RAMP: ReadonlyArray<readonly [step: number, mix: number]> = [
  [25, 0.97],
  [50, 0.94],
  [100, 0.86],
  [200, 0.7],
  [300, 0.5],
  [400, 0.25],
  [500, 0],
  [600, -0.15],
  [700, -0.32],
  [800, -0.45],
  [900, -0.56],
  [950, -0.7],
];

export const RAMP_STEPS = RAMP.map(([step]) => step);

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.trim().slice(1);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** The full brand ramp derived from one seed colour, as [step, hex] pairs. */
export function brandRamp(seed: string): Array<[number, string]> {
  const hex = isHexColor(seed) ? seed : DEFAULT_BRAND_COLOR;
  const [r, g, b] = toRgb(hex);
  return RAMP.map(([step, mix]) => {
    const target = mix >= 0 ? 255 : 0;
    const t = Math.abs(mix);
    return [
      step,
      toHex([r + (target - r) * t, g + (target - g) * t, b + (target - b) * t]),
    ];
  });
}

/**
 * The ramp as a CSS rule. Injected into the document so Tailwind's
 * `bg-brand-500` and friends re-point at the organisation's colour without a
 * rebuild.
 */
export function brandColorCss(seed: string): string {
  const vars = brandRamp(seed)
    .map(([step, hex]) => `--color-brand-${step}:${hex};`)
    .join("");
  return `:root{${vars}}`;
}

/** Ready-made seeds, so an admin without a hex code to hand can still pick
 * something that produces a coherent palette. */
export const BRAND_PRESETS: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Green", hex: DEFAULT_BRAND_COLOR },
  { name: "Teal", hex: "#0f766e" },
  { name: "Blue", hex: "#1d4ed8" },
  { name: "Navy", hex: "#1e3a5f" },
  { name: "Indigo", hex: "#4338ca" },
  { name: "Purple", hex: "#6d28d9" },
  { name: "Crimson", hex: "#b91c1c" },
  { name: "Amber", hex: "#b45309" },
  { name: "Slate", hex: "#334155" },
];
