import { getMongoStatus } from "../config/db.js";
import { env } from "../config/env.js";

export function getHealth(req, res) {
  const mongo = getMongoStatus();
  res.json({
    success: true,
    data: {
      status: "ok",
      service: "BharatKisan AI API",
      timestamp: new Date().toISOString(),
      mongodb: mongo,
      dataGovKeyConfigured: Boolean(env.dataGovApiKey),
    },
  });
}
