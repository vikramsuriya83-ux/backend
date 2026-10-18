export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundTo(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseCoordinate(value, kind) {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  if (kind === "lat" && (parsed < -90 || parsed > 90)) return null;
  if (kind === "lon" && (parsed < -180 || parsed > 180)) return null;
  return parsed;
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
}
