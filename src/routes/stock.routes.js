import express from "express";
import { adjustStock } from "../controllers/stockAdjustment.Controller.js";
import { authenticate} from "../middleware/auth.middleware.js";
import { getStockAdjustments } from "../controllers/stockAdjustment.Controller.js";

const router = express.Router();

router.post("/adjust", authenticate, adjustStock);
router.get("/adjustments", authenticate, getStockAdjustments);

export default router;