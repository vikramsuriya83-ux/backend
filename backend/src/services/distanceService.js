import { AppError } from "../utils/AppError.js";
import { getCached, setCached } from "../utils/cache.js";
import { httpClient } from "../utils/httpClient.js";
import { parseCoordinate, roundTo } from "../utils/numbers.js";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function geocodePlace(name, country = "India") {
  const query = String(name || "").trim();
  if (!query) return null;

  const cacheKey = `geo:${query}:${country}`;
  const cached = getCached(cacheKey);
  if (cached !== null && cached !== undefined) return cached;

  try {
    const response = await httpClient.get(GEOCODE_URL, {
      params: {
        name: query,
        count: 5,
        language: "en",
        format: "json",
      },
    });

    const results = Array.isArray(response.data?.results) ? response.data.results : [];
    const match =
      results.find((item) =>
        String(item.country || "").toLowerCase().includes(country.toLowerCase()),
      ) || results[0];

    const value = match
      ? {
          name: match.name,
          latitude: match.latitude,
          longitude: match.longitude,
          admin1: match.admin1 || "",
          country: match.country || "",
          source: "Open-Meteo Geocoding",
        }
      : null;

    setCached(cacheKey, value, 24 * 60 * 60 * 1000);
    return value;
  } catch {
    setCached(cacheKey, null, 30 * 60 * 1000);
    return null;
  }
}

export async function fetchRouteDistance(originLat, originLon, destLat, destLon) {
  const oLat = parseCoordinate(originLat, "lat");
  const oLon = parseCoordinate(originLon, "lon");
  const dLat = parseCoordinate(destLat, "lat");
  const dLon = parseCoordinate(destLon, "lon");

  if ([oLat, oLon, dLat, dLon].some((value) => value === null)) {
    throw new AppError(
      400,
      "Valid origin and destination coordinates are required to calculate a road route.",
    );
  }

  const cacheKey = `osrm:${oLat}:${oLon}:${dLat}:${dLon}`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, cached: true };

  const url = `https://router.project-osrm.org/route/v1/driving/${oLon},${oLat};${dLon},${dLat}`;

  try {
    const response = await httpClient.get(url, {
      params: { overview: "false" },
    });

    const route = response.data?.routes?.[0];
    if (!route || response.data?.code !== "Ok") {
      throw new AppError(502, "OSRM could not calculate a driving route for these coordinates.");
    }

    const result = {
      distanceKm: roundTo(route.distance / 1000, 1),
      durationMinutes: Math.round(route.duration / 60),
      origin: { latitude: oLat, longitude: oLon },
      destination: { latitude: dLat, longitude: dLon },
      source: "OSRM public demo server",
      note: "Public OSRM is a limited testing service, not a production routing API.",
      retrievedAt: new Date().toISOString(),
      cached: false,
    };

    return setCached(cacheKey, result, 60 * 60 * 1000);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new AppError(504, "The routing service timed out.");
    }
    throw new AppError(502, "Unable to calculate road distance from OSRM.", {
      details: error.message,
    });
  }
}
