import { AppError } from "../utils/AppError.js";
import { getCached, setCached } from "../utils/cache.js";
import { httpClient } from "../utils/httpClient.js";
import { parseCoordinate } from "../utils/numbers.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export function buildWeatherAlerts(days) {
  const alerts = [];
  days.forEach((day) => {
    if (day.precipitationProbability !== null && day.precipitationProbability >= 70) {
      alerts.push({
        type: "rain",
        date: day.date,
        title: "High rain probability",
        description: `${day.precipitationProbability}% chance of precipitation on ${day.date}. Harvest and transport may be delayed.`,
      });
    }
    if (day.precipitationSum !== null && day.precipitationSum >= 20) {
      alerts.push({
        type: "heavy-rain",
        date: day.date,
        title: "Heavy rainfall forecast",
        description: `${day.precipitationSum} mm precipitation is forecast on ${day.date}.`,
      });
    }
    if (day.maxTemperature !== null && day.maxTemperature >= 38) {
      alerts.push({
        type: "heat",
        date: day.date,
        title: "High temperature",
        description: `Maximum temperature of ${day.maxTemperature}°C is forecast on ${day.date}. Protect perishable produce.`,
      });
    }
  });
  return alerts;
}

export async function fetchWeatherForecast(latitude, longitude) {
  const lat = parseCoordinate(latitude, "lat");
  const lon = parseCoordinate(longitude, "lon");
  if (lat === null || lon === null) {
    throw new AppError(400, "Valid latitude and longitude are required.");
  }

  const cacheKey = `weather:${lat}:${lon}`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, cached: true };

  try {
    const response = await httpClient.get(FORECAST_URL, {
      params: {
        latitude: lat,
        longitude: lon,
        timezone: "Asia/Kolkata",
        daily: [
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_sum",
          "precipitation_probability_max",
        ].join(","),
        current: "temperature_2m,precipitation",
      },
    });

    const daily = response.data?.daily;
    if (!daily?.time?.length) {
      throw new AppError(502, "Open-Meteo did not return a usable forecast.");
    }

    const days = daily.time.map((date, index) => ({
      date,
      maxTemperature: daily.temperature_2m_max?.[index] ?? null,
      minTemperature: daily.temperature_2m_min?.[index] ?? null,
      precipitationSum: daily.precipitation_sum?.[index] ?? null,
      precipitationProbability: daily.precipitation_probability_max?.[index] ?? null,
    }));

    const today = days[0] || null;
    const result = {
      latitude: lat,
      longitude: lon,
      timezone: response.data.timezone || "Asia/Kolkata",
      current: response.data.current || null,
      today,
      days,
      alerts: buildWeatherAlerts(days.slice(0, 3)),
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo",
      cached: false,
    };

    return setCached(cacheKey, result, 15 * 60 * 1000);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      throw new AppError(504, "The weather API timed out.");
    }
    throw new AppError(502, "Unable to fetch weather from Open-Meteo.", {
      details: error.message,
    });
  }
}
