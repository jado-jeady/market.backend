// routes/report.routes.js
import express from "express";
import {
  generateSalesReport,
  generateStockReport,
  generateFinancialReport,
  generateCustomerReport,
  generateCategoryReport,
  downloadReportExcel,
  getAllReports,
  getReportById,
} from "../controllers/report.controller.js";
import { authorize, authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate); // Apply authentication middleware to all routes

// Generate reports
router.post(
  "/generate/sales",
  authorize("Admin", "Storekeeper"),
  generateSalesReport,
);
router.post(
  "/generate/stock",
  authorize("Admin", "Storekeeper"),
  generateStockReport,
);
router.post("/generate/financial", authorize("Admin"), generateFinancialReport);
router.post("/generate/customer", authorize("Admin"), generateCustomerReport);
router.post("/generate/category", authorize("Admin"), generateCategoryReport);

// Download report
router.get(
  "/download/:id",
  authorize("Admin", "Storekeeper"),
  downloadReportExcel,
);

// Get reports
router.get("/", authorize("Admin", "Storekeeper"), getAllReports);
router.get("/:id", authorize("Admin", "Storekeeper"), getReportById);

export default router;
