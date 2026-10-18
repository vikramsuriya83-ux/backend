import mongoose from "mongoose";

const priceAlertSchema = new mongoose.Schema(
  {
    crop: { type: String, required: true },
    targetPrice: { type: Number, required: true },
    market: { type: String, default: "" },
  },
  { timestamps: true },
);

export const PriceAlert = mongoose.model("PriceAlert", priceAlertSchema);
