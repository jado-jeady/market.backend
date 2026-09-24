import express from "express";

import {
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllConsumables,
  getAllBaristaItems,
  getProductPriceHistory,
  getPriceChangeSummary,
  getAllPriceChanges,
  getProductBatches,
  getAllBatches,
  receiveStock,
  getProductsWithBatches,
  getExpiryReport,
} from "../controllers/product.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { productValidation } from "../utils/validators.js";
import { getBaristaCategoriesProducts } from "../controllers/category.controller.js";

const router = express.Router();
router.use(authenticate);

router.get("/", getAllProducts);
// Get price change summary for dashboard
router.get("/price-changes/summary", authorize("Admin"), getPriceChangeSummary);

// Get all price changes with filters
router.get("/price-changes", authorize("Admin"), getAllPriceChanges);
// Batches list — must be BEFORE /:id
router.get(
  "/batches",
  authenticate,
  authorize("Admin", "Storekeeper"),
  getAllBatches,
);

router.get("/consumables", getAllConsumables);
router.get("/barcode/:barcode", getProductByBarcode);

// Barista specific routes
router.get("/barista-items", getAllBaristaItems);
router.get("/barista-menu", getBaristaCategoriesProducts);
// Products with batches (for stock management) — must be BEFORE /:id
router.get(
  "/products-with-batches",
  authenticate,
  authorize("Admin", "Storekeeper"),
  getProductsWithBatches,
);

// ⭐ Batch + stock receiving routes (must come before /:id)
router.post(
  "/receive-stock",
  authenticate,
  authorize("Admin", "Storekeeper"),
  receiveStock,
);
// expiring products report route
router.get(
  "/expiry-report",
  authenticate,
  authorize("Admin", "Storekeeper"),
  getExpiryReport,
);

router.get(
  "/:id/batches",
  authenticate,
  authorize("Admin", "Storekeeper"),
  getProductBatches,
);

// Public routes
router.get("/:id", getProductById);

// Protected routes (require authentication)

// Product creation/modification requires ADMIN role
// Update product (with price change tracking)
router.put(
  "/:id",
  authorize("Admin", "Storekeeper"),
  productValidation,
  updateProduct,
);

// Get price change history for a specific product
router.get(
  "/:id/price-history",
  authorize("Admin", "Storekeeper"),
  getProductPriceHistory,
);
router.post("/", authorize("Admin"), productValidation, createProduct);
router.delete("/:id", authorize("Admin"), deleteProduct);

export default router;
