import mongoose from "mongoose";
import { env } from "./env.js";

let connectionState = "disconnected";

export function getMongoStatus() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    configured: Boolean(env.mongodbUri),
    state: states[mongoose.connection.readyState] || connectionState,
  };
}

export async function connectDatabase() {
  if (!env.mongodbUri) {
    connectionState = "not_configured";
    console.warn("MONGODB_URI is not set. Saved preferences will be unavailable.");
    return false;
  }

  try {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    connectionState = "connected";
    console.log("MongoDB connected");
    return true;
  } catch (error) {
    connectionState = "error";
    console.error("MongoDB connection failed:", error.message);
    return false;
  }
}
