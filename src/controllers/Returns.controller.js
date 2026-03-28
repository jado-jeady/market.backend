import db from "../models/index.js";
import { Sequelize, Op } from "sequelize";
import sequelize from "../config/database.js";

const { SaleItem, Product, Return, User, Sale } = db;

/* ==================HANDLING A RETURN SALE====================*/
export const createReturn = async (req, res) => {
  try {
    const { sale_id, items, requested_by } = req.body;

    // Validate sale items
    for (const item of items) {
      const saleItem = await SaleItem.findOne({
        where: { sale_id, product_id: item.product_id },
      });

      // checking if a return exist or refounded before
      const returnExist = await Return.findOne({
        where: {
          sale_id,
          product_id: item.product_id,
          status: "PENDING" || "REFUNDED",
          Sale_item_id: item.sale_item_id,
        },
      });

      if (returnExist) {
        return res.status(400).json({
          success: false,
          message: "A pending return already exists for this item",
        }); // Changed 'error' to 'message' for consistency
      }

      if (!saleItem || item.quantity > saleItem.quantity) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid return quantity" });
      }
    }

    // Save return requests
    const returnRequests = await Promise.all(
      items.map((item) =>
        Return.create({
          sale_id,
          product_id: item.product_id,
          quantity: item.quantity,
          reason: item.reason,
          requested_by,
          Sale_item_id: item.sale_item_id,
          status: "PENDING",
        }),
      ),
    );

    // Update sale status to PENDING if at least one return was created
    if (returnRequests.length > 0) {
      await Sale.update({ status: "PENDING" }, { where: { id: sale_id } });
    }

    res.json(returnRequests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create return request" });
  }
};

/* ==================GETTING ALL RETURN SALES====================*/
export const getAllReturns = async (req, res) => {
  try {
    const returns = await Return.findAll({
      include: [
        {
          model: Sale,
          attributes: ["id", "invoice_number", "status"],
        },
        {
          model: SaleItem,
          attributes: ["id", "quantity"],
          include: [{ model: Product, attributes: ["id", "name"] }],
        },
        {
          model: User,
          as: "Requester",
          attributes: ["id", "full_name"],
        },
      ],
    });

    res.json(returns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
};

/*---------------------- APPROVING RETURN --------------------------*/

const updateSaleStatus = async (sale_id) => {
  const sale = await Sale.findByPk(sale_id, {
    include: [{ model: Return }],
  });

  if (!sale) return;

  const returns = sale.Returns || [];
  const allApproved = returns.every((r) => r.status === "APPROVED");
  const allRejected = returns.every((r) => r.status === "REJECTED");
  const hasPending = returns.some((r) => r.status === "PENDING");

  if (hasPending) {
    sale.status = "PENDING";
  } else if (allApproved) {
    sale.status = "REFUNDED"; // or CLOSED
  } else if (allRejected) {
    sale.status = "COMPLETED"; // back to normal
  } else {
    sale.status = "PARTIALLY_REFUNDED";
  }

  await sale.save();
};

// Approve return
export const approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;
    const returnRecord = await Return.findByPk(id);

    if (!returnRecord)
      return res.status(404).json({ error: "Return not found" });

    returnRecord.status = "APPROVED";
    returnRecord.approved_by = approved_by;
    await returnRecord.save();

    // Update product stock
    const product = await Product.findByPk(returnRecord.product_id);
    if (product) {
      product.available_quantity += returnRecord.quantity;
      await product.save();
    }

    // Adjust sale status
    await updateSaleStatus(returnRecord.sale_id);

    res.json({ message: "Return approved", return: returnRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve return" });
  }
};

// ==========================REJECTING A RETRUN--=========================
export const rejectReturn = async (req, res) => {
  try {
    const { id, approved_by, rejection_reason } = req.body;
    const returnRecord = await Return.findByPk(id);

    if (!returnRecord)
      return res.status(404).json({ error: "Return not found" });

    returnRecord.status = "REJECTED";
    returnRecord.approved_by = approved_by;
    returnRecord.reason = rejection_reason || returnRecord.reason;
    await returnRecord.save();

    // Adjust sale status
    await updateSaleStatus(returnRecord.sale_id);

    res.json({ message: "Return rejected", return: returnRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject return" });
  }
};
