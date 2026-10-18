
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { getCached, setCached } from "../utils/cache.js";
import { httpClient } from "../utils/httpClient.js";
import { toNumber, uniqueSorted } from "../utils/numbers.js";

const DATASET_ID = "9ef84268-d588-465a-a308-a864a43d0070";
const DATASET_URL = `https://api.data.gov.in/resource/${DATASET_ID}`;

export const CROP_ALIASES = {
  Tomato: ["Tomato"],
  "Tomato (Hybrid)": ["Tomato"],
  Onion: ["Onion"],
  "Onion (Bellary)": ["Onion"],
  "Green Chilli": [
    "Green Chilli",
    "Green Chili",
    "Green Chillies",
    "Chilli Green",
  ],
  "Green Chilli (G4)": [
    "Green Chilli",
    "Green Chili",
    "Green Chillies",
    "Chilli Green",
  ],
  Potato: ["Potato"],
  "Potato (Kufri)": ["Potato"],
};

export function resolveCommodity(name) {
  if (!name) return "";

  const trimmed = String(name).trim();

  if (CROP_ALIASES[trimmed]) {
    return CROP_ALIASES[trimmed][0];
  }

  return trimmed.split("(")[0].trim();
}

function pick(record, keys) {
  for (const key of keys) {
    if (
      record[key] !== undefined &&
      record[key] !== null &&
      record[key] !== ""
    ) {
      return record[key];
    }
  }

  return "";
}

export function parseArrivalDate(value) {
  if (!value) return null;

  const text = String(value).trim();

  // Handle ISO dates and ISO timestamps.
  if (
    /^\d{4}-\d{1,2}-\d{1,2}(?:$|T|\s)/.test(text)
  ) {
    const isoDate = new Date(text);

    return Number.isNaN(isoDate.getTime()) ? null : isoDate;
  }

  // Handle DD/MM/YYYY, DD-MM-YYYY, and two-digit years.
  const match = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/,
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);

    if (year < 100) {
      year += 2000;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    // Reject invalid dates such as 31/02/2026.
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  // Handle other parseable date formats.
  const timestamp = Date.parse(text);

  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

export function formatArrivalDate(value) {
  const date = value instanceof Date ? value : parseArrivalDate(value);

  if (!date) {
    return value ? String(value) : "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function normalizeRecord(record) {
  const minPrice = toNumber(
    pick(record, ["min_price", "minPrice", "Min_x0020_Price"]),
  );

  const maxPrice = toNumber(
    pick(record, ["max_price", "maxPrice", "Max_x0020_Price"]),
  );

  const modalPrice = toNumber(
    pick(record, ["modal_price", "modalPrice", "Modal_x0020_Price"]),
  );

  const arrivalRaw = pick(record, [
    "arrival_date",
    "arrivalDate",
    "Arrival_Date",
  ]);

  const parsedDate = parseArrivalDate(arrivalRaw);

  // Skip records that do not contain any usable price.
  if (modalPrice === null && minPrice === null && maxPrice === null) {
    return null;
  }

  return {
    state: String(pick(record, ["state", "State"])).trim(),
    district: String(pick(record, ["district", "District"])).trim(),
    market: String(pick(record, ["market", "Market"])).trim(),
    commodity: String(pick(record, ["commodity", "Commodity"])).trim(),
    variety: String(pick(record, ["variety", "Variety"])).trim(),
    grade: String(pick(record, ["grade", "Grade"])).trim(),
    arrivalDate: formatArrivalDate(parsedDate || arrivalRaw),
    arrivalDateRaw: arrivalRaw,
    arrivalTimestamp: parsedDate ? parsedDate.getTime() : null,
    minPrice,
    maxPrice,
    modalPrice,
    source: "data.gov.in",
  };
}

function mapExternalError(error) {
  const status = error.response?.status;
  const code = error.code || "UNKNOWN_ERROR";
  const body = error.response?.data;

  const apiMessage =
    (typeof body === "string" && body) ||
    body?.message ||
    body?.error ||
    error.message ||
    "Unknown upstream error";

  // Never log request URLs or query parameters because they may
  // contain the API key.
  console.error("[Mandi API] Upstream request failed", {
    hostname: "api.data.gov.in",
    code,
    status: status ?? null,
    message: String(error.message || "Unknown error").slice(0, 200),
  });

  if (
    status === 401 ||
    status === 403 ||
    /api[\s_-]*key/i.test(String(apiMessage))
  ) {
    throw new AppError(
      502,
      "data.gov.in rejected the API key. Check DATA_GOV_IN_API_KEY.",
    );
  }

  if (status === 429) {
    throw new AppError(
      429,
      "data.gov.in rate limit reached. Please wait and retry.",
    );
  }

  if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
    throw new AppError(504, "The mandi price API request timed out.");
  }

  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    throw new AppError(
      502,
      "Could not connect to the data.gov.in mandi price service. Please retry later.",
    );
  }

  // Do not expose raw upstream responses or internal network details.
  throw new AppError(
    502,
    "Unable to fetch mandi prices from data.gov.in.",
  );
}

export async function fetchMandiDataset(filters = {}, options = {}) {
  if (!env.dataGovApiKey) {
    throw new AppError(
      500,
      "DATA_GOV_IN_API_KEY is not configured on the backend.",
    );
  }

  const requestedLimit = Number(options.limit);
  const requestedOffset = Number(options.offset);

  const limit = Math.min(
    Math.max(
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.trunc(requestedLimit)
        : 50,
      1,
    ),
    100,
  );

  const offset =
    Number.isFinite(requestedOffset) && requestedOffset > 0
      ? Math.trunc(requestedOffset)
      : 0;

  const cacheKey = JSON.stringify({
    filters,
    limit,
    offset,
  });

  const cached = getCached(cacheKey);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  // Keep the official resource endpoint and pass query parameters
  // separately through Axios.
  const params = {
    "api-key": env.dataGovApiKey,
    format: "json",
    limit,
    offset,
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params[`filters[${key}]`] = value;
    }
  });

  try {
    const response = await httpClient.get(DATASET_URL, { params });
    const payload = response.data || {};

    const records = Array.isArray(payload.records)
      ? payload.records.map(normalizeRecord).filter(Boolean)
      : [];

    const result = {
      records,
      total: Number(payload.total) || records.length,
      count: Number(payload.count) || records.length,
      limit,
      offset,
      retrievedAt: new Date().toISOString(),
      source: "data.gov.in",
      cached: false,
    };

    return setCached(cacheKey, result, env.mandiCacheTtlMs);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    mapExternalError(error);
  }
}

export async function fetchMandiPrices(query = {}) {
  const commodityInput = query.commodity || "";

  const aliases =
    CROP_ALIASES[commodityInput] ||
    [resolveCommodity(commodityInput)].filter(Boolean);

  const tried = [];
  let lastResult = null;

  const attempts = aliases.length ? aliases : [""];

  for (const commodity of attempts) {
    const filters = {
      commodity: commodity || undefined,
      state: query.state || undefined,
      district: query.district || undefined,
      market: query.market || undefined,
    };

    tried.push(commodity || "(any commodity)");

    lastResult = await fetchMandiDataset(filters, {
      limit: query.limit,
      offset: query.offset,
    });

    if (lastResult.records.length) {
      break;
    }
  }

  return {
    ...lastResult,
    filters: {
      commodity: commodityInput || attempts[0] || "",
      state: query.state || "",
      district: query.district || "",
      market: query.market || "",
    },
    triedCommodities: tried,
  };
}

export async function fetchMandiFilters(state) {
  const cacheKey = `filters:${state || "all"}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const result = await fetchMandiDataset(
    state ? { state } : {},
    { limit: 100, offset: 0 },
  );

  const records = result.records;

  const data = {
    states: uniqueSorted(records.map((item) => item.state)),
    districts: uniqueSorted(records.map((item) => item.district)),
    markets: uniqueSorted(records.map((item) => item.market)),
    commodities: uniqueSorted(records.map((item) => item.commodity)),
    varieties: uniqueSorted(records.map((item) => item.variety)),
    retrievedAt: result.retrievedAt,
    cached: false,
    sampleSize: records.length,
    source: result.source,
    note: "Filter options are built from currently available data.gov.in records, not a complete master list.",
  };

  return setCached(cacheKey, data, env.mandiCacheTtlMs);
}

export function summarizeRecords(records) {
  const priced = records.filter((item) => item.modalPrice !== null);

  if (!priced.length) {
    return {
      latest: null,
      highest: null,
      lowest: null,
      marketCount: 0,
      recordCount: records.length,
    };
  }

  const latestSorted = [...priced].sort((a, b) => {
    const timeDiff =
      (b.arrivalTimestamp || 0) - (a.arrivalTimestamp || 0);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return b.modalPrice - a.modalPrice;
  });

  const highest = [...priced].sort(
    (a, b) => b.modalPrice - a.modalPrice,
  )[0];

  const lowest = [...priced].sort(
    (a, b) => a.modalPrice - b.modalPrice,
  )[0];

  const latest = latestSorted[0];

  const comparable = latestSorted.filter(
    (item) => item.commodity === latest.commodity,
  );

  const previous = comparable.find(
    (item) =>
      item.arrivalTimestamp &&
      latest.arrivalTimestamp &&
      item.arrivalTimestamp < latest.arrivalTimestamp,
  );

  let change = null;

  if (
    previous &&
    latest.modalPrice !== null &&
    previous.modalPrice !== null
  ) {
    const amount = roundSafe(
      latest.modalPrice - previous.modalPrice,
    );

    const percent = previous.modalPrice
      ? roundSafe((amount / previous.modalPrice) * 100)
      : null;

    change = {
      amount,
      percent,
      fromDate: previous.arrivalDate,
      toDate: latest.arrivalDate,
    };
  }

  return {
    latest,
    highest,
    lowest,
    change,
    marketCount: new Set(
      priced.map((item) => `${item.market}|${item.district}`),
    ).size,
    recordCount: priced.length,
  };
}

function roundSafe(value) {
  return Math.round(value * 10) / 10;
}

export function buildPriceTrend(records, commodity) {
  const relevant = records.filter((item) => {
    if (item.modalPrice === null || !item.arrivalTimestamp) {
      return false;
    }

    if (!commodity) {
      return true;
    }

    return item.commodity
      .toLowerCase()
      .includes(resolveCommodity(commodity).toLowerCase());
  });

  const byDate = new Map();

  relevant.forEach((item) => {
    const key = item.arrivalDate;

    if (!byDate.has(key)) {
      byDate.set(key, {
        date: key,
        timestamp: item.arrivalTimestamp,
        prices: [],
      });
    }

    byDate.get(key).prices.push(item.modalPrice);
  });

  const points = [...byDate.values()]
    .map((entry) => ({
      date: entry.date,
      timestamp: entry.timestamp,
      price: Math.round(
        entry.prices.reduce((sum, price) => sum + price, 0) /
          entry.prices.length,
      ),
      sampleSize: entry.prices.length,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return {
    points,
    sufficient: points.length >= 2,
    message:
      points.length >= 2
        ? "Trend uses actual dated mandi records from data.gov.in. This is not a future-price prediction."
        : "Not enough dated mandi records were returned to show a price trend. The current-price API does not guarantee historical coverage.",
  };
}
