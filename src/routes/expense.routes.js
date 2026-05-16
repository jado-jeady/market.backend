import express from "express";
import { upload } from "../config/multer.js";
import {
  createExpense,
  getAllExpenses,
  updateExpense,
} from "../controllers/Expenses.controller.js";

const router = express.Router();

router.post("/", upload.single("receipt"), createExpense);
router.get("/", getAllExpenses);
router.put("/:id", upload.single("receipt"), updateExpense);

export default router;
