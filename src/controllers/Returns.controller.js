import db from "../models/index.js";
import { Sequelize, Op } from "sequelize";
import sequelize from "../config/database.js";

const { SaleItem, Product, Return, User, Sale, ProductBatch } = db;

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
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const returnRecord = await Return.findByPk(id, {
      include: [{ model: Sale, include: [SaleItem] }],
      transaction,
    });

    if (!returnRecord) {
      await transaction.rollback();
      return res.status(404).json({ error: "Return not found" });
    }

    if (returnRecord.status !== "PENDING") {
      await transaction.rollback();
      return res.status(400).json({ error: "Return is already processed" });
    }

    // Find the original sale item to get its batch_id
    const originalSaleItem = await SaleItem.findOne({
      where: {
        sale_id: returnRecord.sale_id,
        product_id: returnRecord.product_id,
      },
      transaction,
    });

    if (!originalSaleItem) {
      await transaction.rollback();
      return res.status(400).json({ error: "Original sale item not found" });
    }

    //  Restore stock into the SAME batch it was sold from
    const product = await Product.findByPk(returnRecord.product_id, {
      transaction,
    });
    if (product && product.track_stock) {
      if (originalSaleItem.batch_id) {
        // Preferred path: restore to same batch
        const batch = await ProductBatch.findByPk(originalSaleItem.batch_id, {
          transaction,
        });
        if (batch) {
          await batch.addStock(
            returnRecord.quantity,
            approved_by,
            `Return #${returnRecord.id} for sale #${returnRecord.sale_id}`,
            transaction,
          );
        }
      } else {
        // Old sale without batch: create a new "RETURN" batch
        const newBatch = await ProductBatch.create(
          {
            product_id: product.id,
            batch_code: `RET-${returnRecord.id}-${Date.now()}`,
            buying_price:
              originalSaleItem.buying_price || product.buying_price || 0,
            selling_price: originalSaleItem.unit_price || product.selling_price,
            stock_quantity: 0,
            is_active: true,
          },
          { transaction },
        );

        await newBatch.addStock(
          returnRecord.quantity,
          approved_by,
          `Return #${returnRecord.id} (pre-batch sale, new batch created)`,
          transaction,
        );
      }

      // Sync cached product stock
      const totalStock = await ProductBatch.sum("stock_quantity", {
        where: { product_id: product.id },
        transaction,
      });
      await product.update(
        { stock_quantity: totalStock || 0 },
        { transaction },
      );
    }

    // Update return status
    returnRecord.status = "APPROVED";
    returnRecord.approved_by = approved_by;
    returnRecord.approved_at = new Date();
    await returnRecord.save({ transaction });

    // Update sale totals + status (existing helpers)
    await updateSaleTotals(returnRecord.sale_id);
    await updateSaleStatus(returnRecord.sale_id);

    await transaction.commit();

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
    await transaction.rollback();
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
  const transaction = await db.sequelize.transaction();
  try {
    const { sale_id, return_ids, approved_by } = req.body;

    if (!sale_id || !return_ids || return_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ error: "Sale ID and return IDs required" });
    }

    const returns = await Return.findAll({
      where: { id: return_ids, sale_id, status: "PENDING" },
      transaction,
    });

    if (returns.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ error: "No pending returns found" });
    }

    for (const returnRecord of returns) {
      const originalSaleItem = await SaleItem.findOne({
        where: {
          sale_id: returnRecord.sale_id,
          product_id: returnRecord.product_id,
        },
        transaction,
      });

      const product = await Product.findByPk(returnRecord.product_id, {
        transaction,
      });

      if (product && product.track_stock) {
        if (originalSaleItem?.batch_id) {
          const batch = await ProductBatch.findByPk(originalSaleItem.batch_id, {
            transaction,
          });
          if (batch) {
            await batch.addStock(
              returnRecord.quantity,
              approved_by,
              `Return #${returnRecord.id} (bulk)`,
              transaction,
            );
          }
        } else {
          const newBatch = await ProductBatch.create(
            {
              product_id: product.id,
              batch_code: `RET-${returnRecord.id}-${Date.now()}`,
              buying_price:
                originalSaleItem?.buying_price || product.buying_price || 0,
              selling_price:
                originalSaleItem?.unit_price || product.selling_price,
              stock_quantity: 0,
              is_active: true,
            },
            { transaction },
          );
          await newBatch.addStock(
            returnRecord.quantity,
            approved_by,
            `Return #${returnRecord.id} (bulk, pre-batch sale)`,
            transaction,
          );
        }

        const totalStock = await ProductBatch.sum("stock_quantity", {
          where: { product_id: product.id },
          transaction,
        });
        await product.update(
          { stock_quantity: totalStock || 0 },
          { transaction },
        );
      }

      returnRecord.status = "APPROVED";
      returnRecord.approved_by = approved_by;
      returnRecord.approved_at = new Date();
      await returnRecord.save({ transaction });
    }

    await updateSaleTotals(sale_id);
    await updateSaleStatus(sale_id);

    await transaction.commit();

    res.json({
      message: `${returns.length} returns approved successfully`,
      count: returns.length,
    });
  } catch (err) {
    await transaction.rollback();
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
