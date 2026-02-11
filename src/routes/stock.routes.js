import express from "express";
import { adjustStock } from "../controllers/stockAdjustment.Controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/adjust", authenticate, adjustStock);

export default router;