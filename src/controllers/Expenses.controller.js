import db from "../models/index.js";
import cloudinary from "../config/cloudinary.js";

const { Expense, ExpenseCategory } = db;

// 1. Create Expense with receipt upload
export const createExpense = async (req, res) => {
  try {
    const {
      amount,
      description,
      category,
      paymentMethod,
      notes,
      shiftId,
      userId,
    } = req.body;

    let receiptUrl = null;

    // If a file was uploaded, push it to Cloudinary
    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "TygaMarket/ExpenseReceipts",
      });
      receiptUrl = uploaded.secure_url;
    }

    const newExpense = await Expense.create({
      amount,
      description,
      category,
      paymentMethod,
      notes,
      shiftId,
      userId,
      receiptUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: newExpense,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Fetch All Expenses (with filtering)
export const getAllExpenses = async (req, res) => {
  try {
    const { status, category } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const { count, rows } = await Expense.findAndCountAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Update Expense (with 24h & Abort logic)
export const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByPk(id);

    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    const hoursElapsed =
      (new Date() - new Date(expense.createdAt)) / (1000 * 60 * 60);

    if (hoursElapsed > 24 && req.body.status !== "aborted") {
      return res.status(403).json({
        success: false,
        message:
          "Edit window closed. Expenses can only be modified within 24 hours.",
      });
    }

    // If updating receipt
    if (req.file) {
      const uploaded = await cloudinary.uploader.upload(req.file.path, {
        folder: "pos/receipts",
      });
      req.body.receiptUrl = uploaded.secure_url;
    }

    await expense.update(req.body);

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
