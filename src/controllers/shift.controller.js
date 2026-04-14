import db from "../models/index.js";
import { Op, where } from "sequelize";

const { Shift, Sale, User } = db;

/* ================= OPEN SHIFT ================= */
export const openShift = async (req, res) => {
  try {
    const { opening_balance, start_time, end_time, opening_note, petty_cash } =
      req.body;
    console.log("this is the body", req.body);
    const cashier_id = req.user.id;
    const shop_name = "Tygamarket";

    // Check if ANY shift in this shop is still open
    const activeShift = await Shift.findOne({
      where: { status: "OPEN", shop_name },
    });
    if (activeShift) {
      return res.status(400).json({
        success: false,
        message: `Cashier ${activeShift.cashier_id} currently has an open shift. Please close it first.`,
      });
    }

    // Derive business_date from start_time (always use the starting day)
    const businessDate = new Date(start_time).toISOString().split("T")[0];
    console.log("This is the bussine date", businessDate);

    // Check if this cashier already had a shift for this business date
    const existingShift = await Shift.findOne({
      where: {
        cashier_id,
        business_date: businessDate,
      },
    });
    if (existingShift) {
      return res.status(400).json({
        success: false,
        message: "You already opened a shift for this business date.",
      });
    }

    // Create new shift
    const shift = await Shift.create({
      cashier_id,
      opening_balance,
      shop_name,
      start_time,
      petty_cash,
      end_time,
      opening_note,
      business_date: businessDate,
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

    if (!shift) {
      return res
        .status(404)
        .json({ success: false, message: "Shift not found" });
    }

    return res.json({ success: true, isShiftOpen: true, data: shift });
  } catch (error) {
    console.error("Get current shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch current shift",
    });
  }
};

/* ================= GET ALL SHIFTS ONLY ================= */
export const getAllOnlyShifts = async (req, res) => {
  try {
    const shifts = await Shift.findAll();
    return res.json({ success: true, data: shifts });
  } catch (error) {
    console.error("Get all shifts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all shifts",
    });
  }
};

/* ================= GET ALL SHIFTS with sales ================= */

export const getAllShifts = async (req, res) => {
  try {
    let { page, limit, start_date, end_date, cashier_id, status, shop_name } =
      req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 30;
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    /* Date filter (business_date or created_at) */
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Op.gte] = new Date(`${start_date}T00:00:00`);
      }
      if (end_date) {
        where.created_at[Op.lte] = new Date(`${end_date}T23:59:59`);
      }
    }

    /* Cashier filter */
    if (cashier_id) {
      where.user_id = cashier_id;
    }

    /* Status filter */
    if (status) {
      where.status = status;
    }

    /* Shop filter */
    if (shop_name) {
      where.shop_name = shop_name;
    }

    const { count, rows } = await Shift.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "username"],
        },
        {
          model: Sale,
          as: "sales",
          attributes: ["id", "total_amount", "status", "created_at"],
        },
      ],
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
      },
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
    const {
      shiftId,
      closing_balance,
      consumables_snapshot,
      closing_note,
      closed_by,
      cash_in_hand,
    } = req.body;
    console.log(`this is the closed by ${closed_by}`);
    const shift = await Shift.findByPk(shiftId);
    if (!shift) {
      return res
        .status(404)
        .json({ success: false, message: "Shift not found" });
    }
    if (shift.status === "CLOSED") {
      return res
        .status(400)
        .json({ success: false, message: "Shift is already closed" });
    }

    // Calculate total sales for this shift
    const totalSales = await Sale.sum("subtotal", {
      where: {
        shift_id: shiftId,
        status: {
          [Op.in]: [
            "COMPLETED",
            "PENDING",
            "PARTIALLY_PENDING",
            "PARTIALLY_REFUNDED",
          ],
        },
      },
    });

    const expectedBalance = totalSales + Number(shift.petty_cash); // rather we will remove the expenses and peti_cash is the money the user starts with for the changes
    const ArikuriMomo = Number(closing_balance) - Number(shift.opening_balance);
    const available_balance = Number(ArikuriMomo) + Number(cash_in_hand);
    const difference = expectedBalance - available_balance;

    // Update fields
    shift.closing_balance = closing_balance;
    shift.closed_at = new Date();
    shift.status = closed_by === 3 ? "ABORTED" : "CLOSED";
    shift.closing_note = closing_note;
    shift.total_sales = totalSales || 0;
    shift.expected_balance = expectedBalance;
    shift.difference = difference;
    shift.closed_by = closed_by;
    shift.consumables_snapshot = consumables_snapshot;
    shift.available_balance = available_balance;
    shift.cash_in_hand = cash_in_hand;

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
      return res
        .status(404)
        .json({ success: false, message: "Shift not found" });
    }
    if (shift.status !== "OPEN") {
      return res
        .status(400)
        .json({ success: false, message: "Only open shifts can be aborted" });
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

// check if shift is open or not
export const isShiftOpen = async (req, res) => {
  try {
    const cashier_id = req.user.id;
    const shift = await Shift.findOne({
      where: { cashier_id, status: "OPEN" },
    });
    return res.json({ success: true, data: shift });
  } catch (error) {
    console.error("Check shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check shift",
    });
  }
};

// get a shift_id by shift bussines_date
export const getShiftIdByBusinessDate = async (req, res) => {
  try {
    const { business_date } = req.params;

    const shift = await Shift.findOne({
      where: { business_date },
      attributes: ["id"], // Only selects the 'id' column
    });

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "No shift found for this date",
      });
    }

    return res.json({
      success: true,
      data: shift.id, // Returns only the ID value
    });
  } catch (error) {
    console.error("Check shift error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check shift",
    });
  }
};

// get all shift's bussiness dates
export const getAllshiftsBussinessDates = async (req, res) => {
  try {
    const bussiness_dates = await Shift.findAll({
      attributes: ["business_date"],
    });
    if (!bussiness_dates) {
      return res.status(404).json({
        success: false,
        message: "No shift found",
      });
    }
    return res.json({
      success: true,
      data: bussiness_dates,
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch shifts",
    });
  }
};

//get last consumables saved
export const getLastConsumables = async (req, res) => {
  try {
    const lastConsumables = await Shift.findOne({
      order: [["created_at", "DESC"]],
      attributes: ["consumables_snapshot"],
    });
    if (!lastConsumables) {
      return res.status(404).json({
        success: false,
        message: "No consumables found",
      });
    }
    return res.json({
      success: true,
      data: lastConsumables,
    });
  } catch (error) {
    console.error("Get consumables error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch consumables",
    });
  }
};
