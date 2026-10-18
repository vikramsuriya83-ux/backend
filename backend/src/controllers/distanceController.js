import { asyncHandler } from "../middleware/errorHandler.js";
import { fetchRouteDistance } from "../services/distanceService.js";

export const getRouteDistance = asyncHandler(async (req, res) => {
  const data = await fetchRouteDistance(
    req.query.originLat,
    req.query.originLon,
    req.query.destinationLat,
    req.query.destinationLon,
  );
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
