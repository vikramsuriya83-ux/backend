import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { getHealth } from "./controllers/healthController.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import calculatorRoutes from "./routes/calculatorRoutes.js";
import comparisonRoutes from "./routes/comparisonRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import distanceRoutes from "./routes/distanceRoutes.js";
import insightsRoutes from "./routes/insightsRoutes.js";
import mandiRoutes from "./routes/mandiRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";

const app = express();

app.use(
  cors({
    origin: [env.frontendOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "100kb" }));
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "BharatKisan AI Backend is running successfully",
    status: "OK"
  });
});
app.get("/api/health", getHealth);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mandi", mandiRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/distance", distanceRoutes);
app.use("/api/comparison", comparisonRoutes);
app.use("/api/calculator", calculatorRoutes);
app.use("/api/insights", insightsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);


export default app;
