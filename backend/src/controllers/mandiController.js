import mongoose from "mongoose";
import { env } from "../config/env.js";
import { SavedMandi } from "../models/SavedMandi.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { fetchMandiFilters, fetchMandiPrices } from "../services/mandiService.js";

export const getMandiPrices = asyncHandler(async (req, res) => {
  const result = await fetchMandiPrices({
    commodity: req.query.commodity,
    state: req.query.state || env.defaultState,
    district: req.query.district,
    market: req.query.market,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  res.json({
    success: true,
    data: result.records,
    meta: {
      total: result.total,
      count: result.count,
      limit: result.limit,
      offset: result.offset,
      retrievedAt: result.retrievedAt,
      cached: result.cached,
      source: result.source,
      filters: result.filters,
      triedCommodities: result.triedCommodities,
    },
  });
});

export const getMandiFilters = asyncHandler(async (req, res) => {
  const data = await fetchMandiFilters(req.query.state || env.defaultState);
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

export const getMandiMarkets = asyncHandler(async (req, res) => {
  const result = await fetchMandiPrices({
    commodity: req.query.commodity,
    state: req.query.state || env.defaultState,
    district: req.query.district,
    market: req.query.market,
    limit: req.query.limit || 100,
    offset: 0,
  });

  const markets = [];
  const seen = new Set();
  result.records.forEach((record) => {
    const key = `${record.market}|${record.district}|${record.commodity}`;
    if (seen.has(key)) return;
    seen.add(key);
    markets.push({
      market: record.market,
      district: record.district,
      state: record.state,
      commodity: record.commodity,
      variety: record.variety,
      grade: record.grade,
      modalPrice: record.modalPrice,
      minPrice: record.minPrice,
      maxPrice: record.maxPrice,
      arrivalDate: record.arrivalDate,
    });
  });

  res.json({
    success: true,
    data: markets,
    meta: {
      retrievedAt: result.retrievedAt,
      cached: result.cached,
      source: result.source,
      count: markets.length,
    },
  });
});

export const toggleSavedMandi = asyncHandler(async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(503, "MongoDB is not connected, so mandis cannot be saved.");
  }

  const { sessionId, market, district, state, commodity } = req.body || {};
  if (!sessionId || !market) {
    throw new AppError(400, "sessionId and market are required.");
  }

  const existing = await SavedMandi.findOne({ sessionId, market, commodity: commodity || "" });
  if (existing) {
    await existing.deleteOne();
    res.json({ success: true, data: { saved: false, market } });
    return;
  }

  const created = await SavedMandi.create({
    sessionId,
    market,
    district: district || "",
    state: state || "",
    commodity: commodity || "",
  });

  res.status(201).json({ success: true, data: created });
});
