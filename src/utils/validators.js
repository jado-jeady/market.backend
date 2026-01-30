import { body } from 'express-validator';

export const registerValidation = [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
];

export const loginValidation = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const productValidation = [
  body('name').notEmpty().withMessage('Product name is required'),
  body('barcode').notEmpty().withMessage('Barcode is required'),
  body('category_id').isInt().withMessage('Valid category ID is required'),
  body('buying_price')
    .isFloat({ min: 0 })
    .withMessage('Valid buying price is required'),
  body('selling_price')
    .isFloat({ min: 0 })
    .withMessage('Valid selling price is required'),
  body('stock_quantity')
    .isInt({ min: 0 })
    .withMessage('Valid stock quantity is required')
];

export const saleValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.product_id')
    .isInt()
    .withMessage('Valid product ID is required'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Valid quantity is required'),
  body('payment_method')
    .isIn(['CASH', 'MOMO', 'CARD'])
    .withMessage('Valid payment method is required')
];