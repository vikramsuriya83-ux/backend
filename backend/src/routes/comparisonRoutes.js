import { Router } from "express";
import { getComparison } from "../controllers/comparisonController.js";

const router = Router();
router.get("/", getComparison);
export default router;
