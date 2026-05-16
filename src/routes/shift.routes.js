import express from "express";
import {
  openShift,
  closeShift,
  getCurrentShift,
  abortShift,
  getAllShifts,
  getAllshiftsBussinessDates,
  getLastConsumables,
  getAllOnlyShifts,
  withdrawShift,
} from "../controllers/shift.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/consumables", authenticate, getLastConsumables);
router.post("/open", authenticate, openShift);
router.get("/current", authenticate, getCurrentShift);
router.get("/", authenticate, getAllOnlyShifts);
router.get("/all", authenticate, getAllShifts);
router.post("/close", authenticate, closeShift);
router.delete("/abort", authenticate, abortShift);
router.get("/business-date", authenticate, getAllshiftsBussinessDates);
router.post("/:shiftID/withdraw", authenticate, withdrawShift);

export default router;
