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
import { createReturn } from "../controllers/Returns.controller.js";

const router = express.Router();

// All sale routes require authentication
router.use(authenticate);

// Sales summary - accessible by both ADMIN and CASHIER
router.get("/summary", getSalesSummary);

// CASHIER can create sales and view their own sales
router.post("/", authorize("Cashier", "Admin"), saleValidation, createSale);
router.get("/my-sales", getAllSales); // Will filter by current user
router.get("/sales-by-shift/:business_date", getSalesByShiftId); // Will filter by current bussiness_date to get shift_id then find all sales by shift_id
router.get("/my-sale", authenticate, getMySales); // New route for cashiers to view their own sales
router.post("/return", authorize("Cashier"), saleValidation, createReturn);
// ADMIN can view all sales
router.get("/", authorize("Admin"), getAllSales);
router.get("/:id", authorize("Admin", "Cashier"), getSaleById);

export default router;
