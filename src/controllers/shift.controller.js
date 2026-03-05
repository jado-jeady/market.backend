import Shift from "../models/Shifts.js";
import Sale from "../models/Sales.js";
import sequelize from "../config/database.js";

/* ================= OPEN SHIFT ================= */
export const openShift = async (req, res) => {
  try {
    const { opening_balance } = req.body;
    const cashier_id = req.user.id;

    // Check if cashier already has an open shift
    const existingShift = await Shift.findOne({
      where: { cashier_id, status: "OPEN" },
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
      opened_at: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Shift opened successfully",
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

/* ================= GET CURRENT SHIFT ================= */
export const getCurrentShift = async (req, res) => {
  try {
    const cashier_id = req.user.id;
    const shift = await Shift.findOne({
      where: { cashier_id, status: "OPEN" },
    });

    return res.json({
      success: true,
      data: shift,
    });
  } catch (error) {
    console.error("Get current shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch current shift",
    });
  }
};

/* ================= GET ALL SHIFTS ================= */
export const getAllShifts = async (req, res) => {
  try {
    const shifts = await Shift.findAll({
      include: {
        association: "cashier", // from Shift.belongsTo(User, { as: "cashier" })
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

/* ================= CLOSE SHIFT ================= */
export const closeShift = async (req, res) => {
  try {
    const { shiftId, closingBalance } = req.body;

    const shift = await Shift.findByPk(shiftId);

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    if (shift.status === "CLOSED") {
      return res.status(400).json({ success: false, message: "Shift is already closed" });
    }

    // Calculate total sales for this shift
    const totalSales = await Sale.sum("subtotal", {
      where: { shift_id: shiftId, status: "COMPLETED" },
    });

    const expectedBalance = Number(shift.opening_balance) + Number(totalSales || 0);
    const difference = Number(closingBalance) - expectedBalance;

    // Update fields
    shift.closing_balance = closingBalance;
    shift.closed_at = new Date();
    shift.status = "CLOSED";
    shift.total_sales = totalSales || 0;
    shift.expected_balance = expectedBalance;
    shift.difference = difference;

    await shift.save();

    return res.json({
      success: true,
      message: "Shift closed successfully",
      data: shift,
    });
  } catch (error) {
    console.error("Close shift error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error closing shift",
    });
  }
};

/* ================= ABORT SHIFT ================= */
export const abortShift = async (req, res) => {
  try {
    const { shiftId } = req.body;
    const shift = await Shift.findByPk(shiftId);

    if (!shift) {
      return res.status(404).json({ success: false, message: "Shift not found" });
    }

    if (shift.status !== "OPEN") {
      return res.status(400).json({ success: false, message: "Only open shifts can be aborted" });
    }

    // Delete all sales linked to this shift
    await Sale.destroy({ where: { shift_id: shiftId } });

    // Delete the shift itself
    await shift.destroy();

    return res.json({
      success: true,
      message: "Shift aborted and deleted successfully",
    });
  } catch (error) {
    console.error("Abort shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to abort shift",
    });
  }
};