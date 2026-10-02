import express from "express";
import {
  createSale,
  getAllSales,
  getMySales,
  getSaleById,
  getCashierSalesByashiftDate,
  getSalesSummary,
  getBaristaSales,
} from "../controllers/sale.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { saleValidation } from "../utils/validators.js";
import {
  approveReturn,
  createReturn,
  rejectReturn,
  getAllReturns,
  getReturnsByCashier,
} from "../controllers/Returns.controller.js";

const router = express.Router();

// All sale routes require authentication
router.use(authenticate);

//Barista sales
router.get("/barista-sales", authorize("Barista"), getBaristaSales);

// Sales summary - accessible by both ADMIN and CASHIER
router.get("/summary", getSalesSummary);

// CASHIER can create sales and view their own sales
router.post(
  "/",
  authorize("Cashier", "Admin", "Barista"),
  saleValidation,
  createSale,
);
router.get("/my-sales", getAllSales);
router.get(
  "/sales-by-shift/:business_date",
  authenticate,
  authorize("Cashier", "Admin", "Barista"),
  getCashierSalesByashiftDate,
);
router.get("/my-sale", authenticate, getMySales);

// RETURN ROUTES
router.post(
  "/return",
  authorize("Cashier", "Admin"),
  saleValidation,
  createReturn,
);
router.get("/return", authorize("Admin"), getAllReturns);
router.get("/return/:id", authenticate, getReturnsByCashier);
router.put("/return/:id/approve", authorize("Admin"), approveReturn);
router.put("/return/:id/reject", authorize("Admin"), rejectReturn);

// ADMIN can view all sales
router.get("/", authorize("Admin"), getAllSales);
router.get("/:id", authorize("Admin", "Cashier"), getSaleById);

export default router;
