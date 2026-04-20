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
      // check if it exists
      const returnExist = await Return.findOne({
        where: {
          sale_id,
          product_id: item.product_id,
          Sale_item_id: item.sale_item_id,
          status: ["PENDING", "APPROVED"], // check both
        },
      });

      if (returnExist) {
        return res.status(400).json({
          success: false,
          message: "A pending or refunded return already exists for this item",
        });
      }

      if (!saleItem || item.quantity > saleItem.quantity) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid return quantity" });
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

    if (returnRequests.length > 0) {
      // Fetch all sale items
      const allSaleItems = await SaleItem.findAll({ where: { sale_id } });

      // Fetch all returns for this sale
      const allReturns = await Return.findAll({
        where: { sale_id, status: "PENDING" },
      });

      const returnedItemIds = new Set(allReturns.map((r) => r.Sale_item_id));

      // Check if all sale items are pending return
      const allReturned = allSaleItems.every((si) =>
        returnedItemIds.has(si.id),
      );

      if (allReturned) {
        await Sale.update({ status: "PENDING" }, { where: { id: sale_id } });
      } else {
        await Sale.update(
          { status: "PARTIALLY_PENDING" },
          { where: { id: sale_id } },
        );
      }
    }

    res.json({ success: true, data: returnRequests });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Failed to create return request" });
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

// Helper function to update sale totals after refund
const updateSaleTotals = async (saleId) => {
  const sale = await Sale.findByPk(saleId, {
    include: [{ model: SaleItem, include: [Product] }],
  });

  if (!sale) return;

  // Get all approved returns for this sale
  const approvedReturns = await Return.findAll({
    where: {
      sale_id: saleId,
      status: "APPROVED",
    },
  });

  // Create a map of refunded quantities by product
  const refundedQuantities = {};
  approvedReturns.forEach((refund) => {
    refundedQuantities[refund.product_id] =
      (refundedQuantities[refund.product_id] || 0) + refund.quantity;
  });

  // Recalculate sale totals excluding refunded items
  let newSubtotal = 0;
  let newVatTotal = 0;
  let newTotalAmount = 0;

  for (const item of sale.SaleItems) {
    const refundedQty = refundedQuantities[item.product_id] || 0;
    const effectiveQuantity = item.quantity - refundedQty;

    if (effectiveQuantity > 0) {
      const itemSubtotal = effectiveQuantity * item.unit_price;
      const itemVat = (itemSubtotal * (item.vat_rate || 0)) / 100;
      const itemTotal = itemSubtotal + itemVat - (item.discount || 0);

      newSubtotal += itemSubtotal;
      newVatTotal += itemVat;
      newTotalAmount += itemTotal;
    }
  }

  // Update sale with new totals
  sale.subtotal = newSubtotal;
  sale.vat_total = newVatTotal;
  sale.total_amount = newTotalAmount;
  await sale.save();

  // Update SaleItems - mark as refunded instead of deleting
  for (const item of sale.SaleItems) {
    const refundedQty = refundedQuantities[item.product_id] || 0;
    if (refundedQty >= item.quantity) {
      // Mark as fully refunded
      item.is_refunded = true;
      await item.save();
    } else if (refundedQty > 0) {
      // Update quantity for partially refunded items
      item.quantity = item.quantity - refundedQty;
      await item.save();
    }
  }
};

// Update sale status based on returns
const updateSaleStatus = async (sale_id) => {
  const sale = await Sale.findByPk(sale_id, {
    include: [
      {
        model: Return,
        as: "Returns",
      },
      {
        model: SaleItem,
        as: "SaleItems",
      },
    ],
  });

  if (!sale) return;

  const returns = sale.Returns || [];
  const hasPending = returns.some((r) => r.status === "PENDING");
  const hasApproved = returns.some((r) => r.status === "APPROVED");
  const hasRejected = returns.some((r) => r.status === "REJECTED");

  // Check which items are refunded
  let allItemsRefunded = true;
  let someItemsRefunded = false;

  for (const item of sale.SaleItems) {
    if (item.is_refunded) {
      someItemsRefunded = true;
    } else {
      allItemsRefunded = false;
    }
  }

  // Determine sale status
  if (hasPending) {
    sale.status = "PENDING_REFUND";
  } else if (allItemsRefunded && someItemsRefunded) {
    sale.status = "FULLY_REFUNDED";
  } else if (someItemsRefunded) {
    sale.status = "PARTIALLY_REFUNDED";
  } else if (hasRejected && !hasApproved) {
    sale.status = "REFUND_REJECTED";
  } else {
    sale.status = "REFUNDED";
  }

  await sale.save();
};

// Approve return
export const approveReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const returnRecord = await Return.findByPk(id, {
      include: [{ model: Sale, include: [SaleItem] }],
    });

    if (!returnRecord) {
      return res.status(404).json({ error: "Return not found" });
    }

    if (returnRecord.status !== "PENDING") {
      return res.status(400).json({ error: "Return is already processed" });
    }

    // Update return status
    returnRecord.status = "APPROVED";
    returnRecord.approved_by = approved_by;
    returnRecord.approved_at = new Date();
    await returnRecord.save();

    // Update product stock (add back the refunded quantity)
    const product = await Product.findByPk(returnRecord.product_id);
    if (product) {
      product.stock_quantity =
        (product.stock_quantity || 0) + returnRecord.quantity;
      await product.save();
    }

    // Update sale totals and mark items as refunded
    await updateSaleTotals(returnRecord.sale_id);

    // Update sale status
    await updateSaleStatus(returnRecord.sale_id);

    // Fetch the updated return with all details
    const updatedReturn = await Return.findByPk(id, {
      include: [
        { model: Product, attributes: ["id", "name", "stock_quantity"] },
        {
          model: Sale,
          attributes: ["id", "status", "subtotal", "total_amount"],
        },
      ],
    });

    res.json({
      message: "Return approved successfully",
      return: updatedReturn,
    });
  } catch (err) {
    console.error("Error approving return:", err);
    res.status(500).json({ error: "Failed to approve return" });
  }
};

// Reject return
export const rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by, rejection_reason } = req.body;

    const returnRecord = await Return.findByPk(id);

    if (!returnRecord) {
      return res.status(404).json({ error: "Return not found" });
    }

    if (returnRecord.status !== "PENDING") {
      return res.status(400).json({ error: "Return is already processed" });
    }

    // Update return status
    returnRecord.status = "REJECTED";
    returnRecord.rejected_by = rejected_by;
    returnRecord.rejection_reason = rejection_reason;
    returnRecord.rejected_at = new Date();
    await returnRecord.save();

    // Update sale status
    await updateSaleStatus(returnRecord.sale_id);

    res.json({
      message: "Return rejected",
      return: returnRecord,
    });
  } catch (err) {
    console.error("Error rejecting return:", err);
    res.status(500).json({ error: "Failed to reject return" });
  }
};

// Bulk approve multiple returns for a sale
export const bulkApproveReturns = async (req, res) => {
  try {
    const { sale_id, return_ids, approved_by } = req.body;

    if (!sale_id || !return_ids || return_ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Sale ID and return IDs are required" });
    }

    const returns = await Return.findAll({
      where: {
        id: return_ids,
        sale_id: sale_id,
        status: "PENDING",
      },
    });

    if (returns.length === 0) {
      return res.status(404).json({ error: "No pending returns found" });
    }

    // Approve all returns
    for (const returnRecord of returns) {
      returnRecord.status = "APPROVED";
      returnRecord.approved_by = approved_by;
      returnRecord.approved_at = new Date();
      await returnRecord.save();

      // Update product stock for each
      const product = await Product.findByPk(returnRecord.product_id);
      if (product) {
        product.stock_quantity =
          (product.stock_quantity || 0) + returnRecord.quantity;
        await product.save();
      }
    }

    // Update sale totals
    await updateSaleTotals(sale_id);

    // Update sale status
    await updateSaleStatus(sale_id);

    res.json({
      message: `${returns.length} returns approved successfully`,
      count: returns.length,
    });
  } catch (err) {
    console.error("Error bulk approving returns:", err);
    res.status(500).json({ error: "Failed to bulk approve returns" });
  }
};

// ========================== GETTING RETURNS BY CASHIER =============================
export const getReturnsByCashier = async (req, res) => {
  try {
    const { id: cashierId } = req.params;
    const { rows: returns, count } = await Return.findAndCountAll({
      where: { requested_by: cashierId },
      include: [{ model: Sale, include: [SaleItem] }],
      distinct: true,
    });
    res.json({ returns, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
};
