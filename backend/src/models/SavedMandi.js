import mongoose from "mongoose";

const savedMandiSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    market: { type: String, required: true },
    district: { type: String, default: "" },
    state: { type: String, default: "" },
    commodity: { type: String, default: "" },
  },
  { timestamps: true },
);

savedMandiSchema.index({ sessionId: 1, market: 1, commodity: 1 }, { unique: true });

export const SavedMandi = mongoose.model("SavedMandi", savedMandiSchema);
