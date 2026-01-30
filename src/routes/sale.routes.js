import express from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  getSalesSummary
} from '../controllers/sale.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { saleValidation } from '../utils/validators.js';

const router = express.Router();

// All sale routes require authentication
router.use(authenticate);

// Sales summary - accessible by both ADMIN and CASHIER
router.get('/summary', getSalesSummary);

// CASHIER can create sales and view their own sales
router.post('/', authorize('CASHIER', 'ADMIN'), saleValidation, createSale);
router.get('/my-sales', getAllSales); // Will filter by current user

// ADMIN can view all sales
router.get('/', authorize('ADMIN'), getAllSales);
router.get('/:id', authorize('ADMIN', 'CASHIER'), getSaleById);

export default router;