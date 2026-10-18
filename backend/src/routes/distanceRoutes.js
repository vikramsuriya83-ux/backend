import { Router } from "express";
import { getRouteDistance } from "../controllers/distanceController.js";

const router = Router();
router.get("/route", getRouteDistance);
export default router;
