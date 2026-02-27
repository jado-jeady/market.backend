import express from "express";
import {
  openShift,
  closeShift,
  getCurrentShift,
  getAllShifts,
} from "../controllers/shift.controller.js";

import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post("/open", authenticate, openShift);
router.post("/close", authenticate, closeShift);
router.get("/current", authenticate, getCurrentShift);
router.get("/",authenticate, getAllShifts);

export default router;