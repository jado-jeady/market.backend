import express from "express";
import {
  getSalesReport,
  getProfitReport,
  getVatReport,
  getShiftReport,
  getStockMovementReport,
  getPurchaseReport,
  getReportFilters,
  // Keep the legacy endpoints if you still use them anywhere:
  // generateSalesReport,
  // generateStockReport,
  // generateFinancialReport,
  // generateCustomerReport,
  // generateCategoryReport,
  // downloadReportExcel,
  // getAllReports,
  // getReportById,
} from "../controllers/report.controller.js";
import { authorize, authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate);

/* ---- New live reports ---- */
router.get("/sales", authorize("Admin", "Storekeeper"), getSalesReport);
router.get("/profit", authorize("Admin"), getProfitReport);
router.get("/vat", authorize("Admin"), getVatReport);
router.get("/shifts", authorize("Admin"), getShiftReport);
router.get(
  "/stock-movements",
  authorize("Admin", "Storekeeper"),
  getStockMovementReport,
);
router.get("/purchases", authorize("Admin", "Storekeeper"), getPurchaseReport);
router.get("/filters", authorize("Admin", "Storekeeper"), getReportFilters);

export default router;
