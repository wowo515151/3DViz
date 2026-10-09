import { hslToHex, rgbToHsl } from "./colors.js";

function clampUnit(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a number between 0 and 1.`);
  }
  return value;
}

/** Return evenly spaced light-to-dark shades that retain a color's hue. */
export function generateColorShades(color, count, {
  lightnessStart = 0.88,
  lightnessEnd = 0.3,
} = {}) {
  if (!Number.isSafeInteger(color) || color < 0 || color > 0xffffff) {
    throw new RangeError("color must be a 24-bit RGB integer.");
  }
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative safe integer.");
  }
  clampUnit(lightnessStart, "lightnessStart");
  clampUnit(lightnessEnd, "lightnessEnd");
  if (count === 0) return [];

  const { hue, saturation } = rgbToHsl(color);
  if (count === 1) return [hslToHex(hue, saturation, (lightnessStart + lightnessEnd) / 2)];
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const lightness = lightnessStart + (lightnessEnd - lightnessStart) * progress;
    return hslToHex(hue, saturation, lightness);
  });
}
