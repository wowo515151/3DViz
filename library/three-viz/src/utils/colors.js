function clampUnit(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a number between 0 and 1.`);
  }
  return value;
}

function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = ((hue % 1) + 1) % 1 * 6;
  const secondary = chroma * (1 - Math.abs(section % 2 - 1));
  const offset = lightness - chroma / 2;
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return [red, green, blue].reduce((hex, channel) => (hex << 8) | Math.round((channel + offset) * 255), 0);
}

/** Return a rainbow palette of evenly spaced 24-bit RGB colors. */
export function generateRainbowColors(count, {
  startHue = 0,
  saturation = 0.82,
  lightness = 0.59,
} = {}) {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("count must be a non-negative safe integer.");
  }
  if (!Number.isFinite(startHue)) throw new RangeError("startHue must be finite.");
  clampUnit(saturation, "saturation");
  clampUnit(lightness, "lightness");
  if (count === 0) return [];
  return Array.from({ length:count }, (_, index) => hslToHex(startHue + index / count, saturation, lightness));
}
