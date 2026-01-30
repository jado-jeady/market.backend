import express from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/category.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { body } from 'express-validator';

const router = express.Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Protected routes (require authentication)
router.use(authenticate);

// Category creation/modification requires ADMIN role
router.post(
  '/',
  authorize('ADMIN'),
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional()
  ],
  createCategory
);

router.put(
  '/:id',
  authorize('ADMIN'),
  [
    body('name').optional(),
    body('description').optional()
  ],
  updateCategory
);

router.delete('/:id', authorize('ADMIN'), deleteCategory);

export default router;