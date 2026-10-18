import mongoose from "mongoose";
import { SavedCalculation } from "../models/SavedCalculation.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { toNumber, roundTo } from "../utils/numbers.js";

function toQuintals(quantity, unit) {
  if (unit === "Ton" || unit === "Tonnes") return quantity * 10;
  if (unit === "Kg") return quantity / 100;
  return quantity;
}

export function calculateNetProceeds(body) {
  const quantity = toNumber(body.quantity);
  const sellingPrice = toNumber(body.sellingPrice);
  const unit = body.unit || "Qt";

  if (quantity === null || quantity < 0) {
    throw new AppError(400, "Quantity must be a number of 0 or more.");
  }
  if (sellingPrice === null || sellingPrice < 0) {
    throw new AppError(400, "Selling price must be a number of 0 or more.");
  }

  const transport = Math.max(0, toNumber(body.transport) ?? 0);
  const labour = Math.max(0, toNumber(body.labour ?? body.loading) ?? 0);
  const marketFee = Math.max(0, toNumber(body.marketFee ?? body.commission) ?? 0);
  const handling = Math.max(0, toNumber(body.handling) ?? 0);
  const other = Math.max(0, toNumber(body.other) ?? 0);

  const quintals = toQuintals(quantity, unit);
  const grossRevenue = roundTo(quintals * sellingPrice, 2);
  const totalExpenses = roundTo(transport + labour + marketFee + handling + other, 2);
  const estimatedNet = roundTo(grossRevenue - totalExpenses, 2);

  return {
    crop: body.crop || "",
    market: body.market || "",
    quantity,
    unit,
    quintals: roundTo(quintals, 4),
    sellingPrice,
    expenses: { transport, labour, marketFee, handling, other },
    grossRevenue,
    totalExpenses,
    estimatedNet,
    netPerQuintal: quintals > 0 ? roundTo(estimatedNet / quintals, 2) : 0,
    disclaimer:
      "This is an estimate based on the values you entered. It is not a guaranteed sale outcome.",
  };
}

export const postNetProceeds = asyncHandler(async (req, res) => {
  const data = calculateNetProceeds(req.body || {});
  let saved = null;

  if (req.body?.save === true && mongoose.connection.readyState === 1) {
    saved = await SavedCalculation.create({
      crop: data.crop,
      market: data.market,
      quantity: data.quantity,
      unit: data.unit,
      sellingPrice: data.sellingPrice,
      estimatedGross: data.grossRevenue,
      totalExpenses: data.totalExpenses,
      estimatedNet: data.estimatedNet,
    });
  }

  res.json({
    success: true,
    data: { ...data, savedId: saved?._id || null },
  });
});
