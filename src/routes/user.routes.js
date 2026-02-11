import express from 'express';
import {
  getAllUsers,
  getUserById,
  getCashiers,
  updateUser,
  deleteUser,
  toggleUserStatus
} from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

// Only ADMIN can access user management routes
router.use(authorize('Admin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.get('/cashiers', getCashiers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.patch('/:id/toggle-status', toggleUserStatus);

export default router;