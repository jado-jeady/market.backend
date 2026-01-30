import express from 'express';
import {
  register,
  login,
  getProfile
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  registerValidation,
  loginValidation
} from '../utils/validators.js';

const router = express.Router();

router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', authenticate, getProfile);

export default router;