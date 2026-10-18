import { Router } from "express";
import {
  getMandiFilters,
  getMandiMarkets,
  getMandiPrices,
  toggleSavedMandi,
} from "../controllers/mandiController.js";

const router = Router();

router.get("/prices", getMandiPrices);
router.get("/filters", getMandiFilters);
router.get("/markets", getMandiMarkets);
router.post("/saved", toggleSavedMandi);

export default router;
