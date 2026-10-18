import { Router } from "express";
import { getPriceInsights, savePriceAlert } from "../controllers/forecastController.js";

const router = Router();
router.get("/", getPriceInsights);
router.post("/alerts", savePriceAlert);
export default router;
