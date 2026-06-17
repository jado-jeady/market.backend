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
} from "../controllers/product.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { productValidation } from "../utils/validators.js";
import { getBaristaCategoriesProducts } from "../controllers/category.controller.js";

const router = express.Router();

router.get("/", getAllProducts);

router.get("/consumables", getAllConsumables);
router.get("/barcode/:barcode", getProductByBarcode);

// Barista specific routes
router.get("/barista-items", getAllBaristaItems);
router.get("/barista-menu", getBaristaCategoriesProducts);

// Public routes
router.get("/:id", getProductById);

// Protected routes (require authentication)
router.use(authenticate);

// Product creation/modification requires ADMIN role

router.post("/", authorize("Admin"), productValidation, createProduct);
router.put("/:id", authorize("Admin"), productValidation, updateProduct);
router.delete("/:id", authorize("Admin"), deleteProduct);

export default router;
