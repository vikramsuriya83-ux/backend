import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  port: numberFromEnv("PORT", 5000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  mongodbUri: process.env.MONGODB_URI || "",
  dataGovApiKey: process.env.DATA_GOV_IN_API_KEY || "",
  defaultState: process.env.DEFAULT_STATE || "Tamil Nadu",
  defaultDistrict: process.env.DEFAULT_DISTRICT || "Coimbatore",
  defaultLatitude: Number(process.env.DEFAULT_LATITUDE || 11.0168),
  defaultLongitude: Number(process.env.DEFAULT_LONGITUDE || 76.9558),
  requestTimeoutMs: numberFromEnv("REQUEST_TIMEOUT_MS", 12000),
  mandiCacheTtlMs: numberFromEnv("MANDI_CACHE_TTL_MS", 600000),
};
