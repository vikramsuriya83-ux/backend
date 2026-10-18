import mongoose from "mongoose";

const savedCalculationSchema = new mongoose.Schema(
  {
    crop: String,
    market: String,
    quantity: Number,
    unit: String,
    sellingPrice: Number,
    estimatedGross: Number,
    totalExpenses: Number,
    estimatedNet: Number,
  },
  { timestamps: true },
);

export const SavedCalculation = mongoose.model(
  "SavedCalculation",
  savedCalculationSchema,
);
