import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { fetchMandiPrices, summarizeRecords } from "../services/mandiService.js";
import { fetchRouteDistance, geocodePlace } from "../services/distanceService.js";

export const getComparison = asyncHandler(async (req, res) => {
  const commodity = req.query.commodity || "Tomato";
  const state = req.query.state || env.defaultState;

  const mandi = await fetchMandiPrices({
    commodity,
    state,
    district: req.query.district,
    market: req.query.market,
    limit: req.query.limit || 40,
    offset: 0,
  });

  const originQuery = [env.defaultDistrict, env.defaultState].filter(Boolean).join(", ");
  const originPlace = await geocodePlace(originQuery);
  const origin = originPlace
    ? {
        name: originPlace.name,
        latitude: originPlace.latitude,
        longitude: originPlace.longitude,
        source: originPlace.source,
      }
    : {
        name: env.defaultDistrict,
        latitude: env.defaultLatitude,
        longitude: env.defaultLongitude,
        source: "configured DEFAULT_LATITUDE / DEFAULT_LONGITUDE",
      };

  const uniqueMarkets = [];
  const seen = new Set();
  for (const record of mandi.records) {
    const key = `${record.market}|${record.district}`;
    if (seen.has(key) || !record.market) continue;
    seen.add(key);
    uniqueMarkets.push(record);
    if (uniqueMarkets.length >= 8) break;
  }

  const markets = [];
  for (const record of uniqueMarkets) {
    const placeName = [record.market, record.district, record.state]
      .filter(Boolean)
      .join(", ");
    const geo = await geocodePlace(placeName) || await geocodePlace(record.district);

    let route = null;
    let routeError = null;
    if (geo && origin?.latitude != null && origin?.longitude != null) {
      try {
        route = await fetchRouteDistance(
          origin.latitude,
          origin.longitude,
          geo.latitude,
          geo.longitude,
        );
      } catch (error) {
        routeError = error.message;
      }
    } else {
      routeError = "Reliable coordinates were not available, so a road route cannot be calculated.";
    }

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
      coordinates: geo
        ? { latitude: geo.latitude, longitude: geo.longitude, source: geo.source }
        : null,
      route: route
        ? {
            distanceKm: route.distanceKm,
            durationMinutes: route.durationMinutes,
            source: route.source,
          }
        : null,
      routeError,
    });
  }

  const priced = markets.filter((item) => item.modalPrice !== null);
  const lowest = priced.length
    ? [...priced].sort((a, b) => a.modalPrice - b.modalPrice)[0]
    : null;

  res.json({
    success: true,
    data: {
      commodity,
      state,
      origin,
      markets,
      lowestPriceMarket: lowest
        ? {
            market: lowest.market,
            district: lowest.district,
            modalPrice: lowest.modalPrice,
            note: "Lowest modal price among comparable returned records. This is not a profitability ranking unless transport and other costs are included.",
          }
        : null,
      summary: summarizeRecords(mandi.records),
    },
    meta: {
      retrievedAt: mandi.retrievedAt,
      cached: mandi.cached,
      source: mandi.source,
      recordCount: mandi.records.length,
    },
  });
});
