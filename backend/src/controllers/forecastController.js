import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { PriceAlert } from "../models/PriceAlert.js";
import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { toNumber } from "../utils/numbers.js";
import {
  buildPriceTrend,
  fetchMandiPrices,
  summarizeRecords,
} from "../services/mandiService.js";
import { fetchWeatherForecast } from "../services/weatherService.js";

export const getPriceInsights = asyncHandler(async (req, res) => {
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
    weather = await fetchWeatherForecast(
      req.query.latitude || env.defaultLatitude,
      req.query.longitude || env.defaultLongitude,
    );
  } catch (error) {
    weatherError = error.message;
  }

  res.json({
    success: true,
    data: {
      commodity,
      state,
      summary,
      trend,
      weather,
      weatherError,
      empty: mandi.records.length === 0,
      disclaimer:
        "This page shows recent mandi observations and weather forecasts. It does not predict future prices.",
    },
    meta: {
      retrievedAt: mandi.retrievedAt,
      cached: mandi.cached,
      source: mandi.source,
    },
  });
});

export const savePriceAlert = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, "MongoDB is not connected, so alerts cannot be saved.");
  }

  const targetPrice = toNumber(req.body?.targetPrice);
  const crop = String(req.body?.crop || "").trim();
  if (!crop || targetPrice === null || targetPrice <= 0) {
    throw new AppError(400, "A crop and a target price greater than 0 are required.");
  }

  const alert = await PriceAlert.create({
    crop,
    targetPrice,
    market: req.body?.market || "",
  });

  res.status(201).json({
    success: true,
    data: alert,
    meta: {
      note: "The alert is stored in MongoDB. This app does not send push notifications.",
    },
  });
});
