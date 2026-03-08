import express from 'express';
import {authenticate} from '../middleware/auth.middleware.js';
import {
  createProduction,
  approveProduction,
  rejectProduction,
  getApprovedProductions,
  getRejectedProductions,
  abortProduction,
  getAllProductions,
  getProductionReport,
  getRecentApprovedProductions
} from '../controllers/production.controller.js';

const router = express.Router();



router.post('/production', authenticate, createProduction);
router.get('/productions', authenticate, getAllProductions);

router.patch('/production/:id/approve', authenticate, approveProduction);
router.patch('/production/:id/reject', authenticate, rejectProduction);
router.get('/production/approved', authenticate, getApprovedProductions);
router.delete("/production/:id", authenticate, abortProduction);
router.get("/production/weekly-approved",authenticate, getRecentApprovedProductions);



router.get('/production/rejected', authenticate, getRejectedProductions);
router.get('/production/report', authenticate, getProductionReport);

export default router;