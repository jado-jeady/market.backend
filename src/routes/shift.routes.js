import express from "express";
import {
  openShift,
  closeShift,
  getCurrentShift,
  abortShift,
  getAllShifts,
} from "../controllers/shift.controller.js";

import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/open", authenticate, openShift);
router.get("/current", authenticate, getCurrentShift);
router.get("/", authenticate, getAllShifts);
router.post("/close", authenticate, closeShift);
router.delete("/abort", authenticate, abortShift);


export default router;