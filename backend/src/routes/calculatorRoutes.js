import { Router } from "express";
import { postNetProceeds } from "../controllers/calculatorController.js";

const router = Router();
router.post("/net-proceeds", postNetProceeds);
export default router;
