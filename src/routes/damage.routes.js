import express from "express";
import { uploadDamageImages } from "../config/cloudinary.js";
import {
  createDamageReport,
  getAllDamageReports,
  getDamageReportById,
  updateReportStatus,
  deleteDamageReport,
  getMyDamageReports,
} from "../controllers/Damage.controller.js";
import { authenticate } from "../middleware/auth.middleware.js"; // ← your existing auth middleware

const router = express.Router();

router.use(authenticate); // all routes require auth

router
  .route("/")
  .get(getAllDamageReports)
  .post(uploadDamageImages, createDamageReport); // multer runs before controller

router.route("/my/reports").get(getMyDamageReports); // new route for user's own reports

router.route("/:id").get(getDamageReportById).delete(deleteDamageReport);

router.patch("/:id/status", updateReportStatus);
router.delete("/:id", deleteDamageReport);

export default router;
