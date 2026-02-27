import Shift from "../models/Shifts.js";
import Sale from "../models/Sales.js";
import sequelize from "../config/database.js";

/* ================= OPEN SHIFT ================= */

export const openShift = async (req, res) => {
  try {
    const { opening_balance } = req.body;
    const cashier_id = req.user.id;
    console.log(cashier_id)
    // Check if cashier already has open shift
    const existingShift = await Shift.findOne({
      where: {
        cashier_id,
        status: "OPEN",
      },
    });

    if (existingShift) {
      return res.status(400).json({
        success: false,
        message: "You already have an open shift",
      });
    }

    const shift = await Shift.create({
      cashier_id,
      opening_balance,
      shop_name: req.user.shop_name,
    });

    return res.status(201).json({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error("Open shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to open shift",
    });
  }
};

export const getCurrentShift = async (req, res) => {
  try {
    const shift = await Shift.findOne({
      where: {
        status: "OPEN",
      },
    });

    return res.json({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error("Get current shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shift",
    });
  }
};


export const getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.findAll({
      include: {
        association: "User",
        attributes: ["full_name", "username"],
      },
      order: [["created_at", "DESC"]],
    });

    return res.json({
      success: true,
      data: shifts,
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shifts",
    });
  }
};




export const closeShift = async (req, res) => {
  try {
    const { shiftId, closingBalance } = req.body;

    // Find the shift by primary key
    const shift = await Shift.findByPk(shiftId);

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    if (shift.status === "CLOSED") {
      return res.status(400).json({ success: false, message: "Shift is already closed" });
    }

    // Calculate difference between expected and closing balance
    const difference = closingBalance - (shift.expected_balance || 0);

    // Update fields
    shift.closing_balance = closingBalance;
    shift.closed_at = new Date();
    shift.status = "CLOSED";
    shift.difference = difference;

    await shift.save();

    return res.json({
      success: true,
      message: "Shift closed successfully",
      data: shift,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error closing shift",
    });
  }
};