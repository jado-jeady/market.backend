import express from "express";
import {
  createSale,
  getAllSales,
  getMySales,
  getSaleById,
  getSalesByShiftId,
  getSalesSummary,
} from "../controllers/sale.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { saleValidation } from "../utils/validators.js";
import {
  approveReturn,
  createReturn,
  getAllReturns,
} from "../controllers/Returns.controller.js";

const router = express.Router();

// All sale routes require authentication
router.use(authenticate);

// Sales summary - accessible by both ADMIN and CASHIER
router.get("/summary", getSalesSummary);

// CASHIER can create sales and view their own sales
router.post("/", authorize("Cashier", "Admin"), saleValidation, createSale);
router.get("/my-sales", getAllSales);
router.get("/sales-by-shift/:business_date", getSalesByShiftId);
router.get("/my-sale", authenticate, getMySales);

// RETURN ROUTES
router.post("/return", authorize("Cashier"), saleValidation, createReturn);
router.get("/return", authorize("Admin"), getAllReturns);
router.put("/return/:id/approve", authorize("Admin"), approveReturn);

// ADMIN can view all sales
router.get("/", authorize("Admin"), getAllSales);
router.get("/:id", authorize("Admin", "Cashier"), getSaleById);

export default router;
