import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  buildPriceTrend,
  fetchMandiPrices,
  summarizeRecords,
} from "../services/mandiService.js";
import { fetchWeatherForecast } from "../services/weatherService.js";

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const commodity = req.query.commodity || "Tomato";
  const state = req.query.state || env.defaultState;

  const mandi = await fetchMandiPrices({
    commodity,
    state,
    district: req.query.district,
    limit: 100,
    offset: 0,
  });

  const summary = summarizeRecords(mandi.records);
  const trend = buildPriceTrend(mandi.records, commodity);

  let weather = null;
  let weatherError = null;
  try {
    weather = await fetchWeatherForecast(env.defaultLatitude, env.defaultLongitude);
  } catch (error) {
    weatherError = error.message;
  }

  const opportunities = [];
  if (summary.highest) {
    opportunities.push({
      name: summary.highest.market,
      location: `${summary.highest.district || summary.highest.state}`,
      price: summary.highest.modalPrice,
      arrivalDate: summary.highest.arrivalDate,
      label: "Highest reported modal price",
    });
  }
  if (summary.latest && summary.latest.market !== summary.highest?.market) {
    opportunities.push({
      name: summary.latest.market,
      location: `${summary.latest.district || summary.latest.state}`,
      price: summary.latest.modalPrice,
      arrivalDate: summary.latest.arrivalDate,
      label: "Latest available record",
    });
  }

  res.json({
    success: true,
    data: {
      region: {
        state,
        district: req.query.district || env.defaultDistrict,
        latitude: env.defaultLatitude,
        longitude: env.defaultLongitude,
      },
      commodity,
      summary,
      trend,
      opportunities,
      weather,
      weatherError,
      empty: mandi.records.length === 0,
    },
    meta: {
      retrievedAt: mandi.retrievedAt,
      cached: mandi.cached,
      source: mandi.source,
      recordCount: mandi.records.length,
      triedCommodities: mandi.triedCommodities,
    },
  });
});
