import express from 'express';
import {
  getAllProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct
} from '../controllers/product.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { productValidation } from '../utils/validators.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/barcode/:barcode', getProductByBarcode);
router.get('/:id', getProductById);

// Protected routes (require authentication)
router.use(authenticate);

// Product creation/modification requires ADMIN role
router.post('/', authorize('ADMIN'), productValidation, createProduct);
router.put('/:id', authorize('ADMIN'), productValidation, updateProduct);
router.delete('/:id', authorize('ADMIN'), deleteProduct);

export default router;