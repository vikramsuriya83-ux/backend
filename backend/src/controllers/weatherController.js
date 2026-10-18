import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { fetchWeatherForecast } from "../services/weatherService.js";

export const getWeatherForecast = asyncHandler(async (req, res) => {
  const latitude = req.query.latitude || env.defaultLatitude;
  const longitude = req.query.longitude || env.defaultLongitude;
  const data = await fetchWeatherForecast(latitude, longitude);
  res.json({
    success: true,
    data,
    meta: {
      retrievedAt: data.retrievedAt,
      cached: data.cached,
      source: data.source,
    },
  });
});
