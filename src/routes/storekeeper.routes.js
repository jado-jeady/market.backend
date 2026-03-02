import express from 'express';
import {authenticate} from '../middleware/auth.middleware.js';
import {
  createProduction,
  approveProduction,
  rejectProduction,
  getApprovedProductions,
  getRejectedProductions,
  getAllProductions,
  getProductionReport
} from '../controllers/production.controller.js';

const router = express.Router();



router.post('/production', authenticate, createProduction);
router.get('/productions', authenticate, getAllProductions);

router.patch('/production/:id/approve', authenticate, approveProduction);
router.patch('/production/:id/reject', authenticate, rejectProduction);
router.get('/production/approved', authenticate, getApprovedProductions);
router.get('/production/rejected', authenticate, getRejectedProductions);
router.get('/production/report', authenticate, getProductionReport);

export default router;