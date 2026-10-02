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
          sale_item_id: item.sale_item_id,
          status: { [Op.in]: ["PENDING", "APPROVED"] },
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
          sale_item_id: item.sale_item_id,
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

      const returnedItemIds = new Set(allReturns.map((r) => r.sale_item_id));

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
          attributes: ["id", "invoice_number", "status", "total_amount"],
        },
        {
          model: SaleItem,
          as: "SaleItem",
          attributes: [
            "id",
            "quantity",
            "is_refunded",
            "unit_price",
            "product_name",
          ],
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "barcode"],
            },
          ],
        },
        { model: User, as: "Requester", attributes: ["id", "full_name"] },
        { model: User, as: "Approver", attributes: ["id", "full_name"] },
      ],
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: returns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch returns" });
  }
};
/*---------------------- APPROVING RETURN --------------------------*/

// Helper function to update sale totals after refund
const updateSaleTotals = async (saleId) => {
  const sale = await Sale.findByPk(saleId, {
    include: [{ model: SaleItem, as: "items" }],
  });

  if (!sale) return;

  // Get all approved returns for this sale (grouped by sale_item_id)
  const approvedReturns = await Return.findAll({
    where: { sale_id: saleId, status: "APPROVED" },
  });

  // Map by sale_item_id
  const refundedBySaleItem = {};
  for (const r of approvedReturns) {
    refundedBySaleItem[r.sale_item_id] =
      (refundedBySaleItem[r.sale_item_id] || 0) + r.quantity;
  }

  let newSubtotal = 0;
  let newVatTotal = 0;
  let newTotalAmount = 0;

  for (const item of sale.items) {
    const refundedQty = refundedBySaleItem[item.id] || 0;
    const effectiveQty = item.quantity - refundedQty;

    if (effectiveQty <= 0) continue;

    // Ratio of the item's original price kept
    const ratio = effectiveQty / item.quantity;
    const itemSubtotal = parseFloat(item.unit_price || 0) * effectiveQty;
    const itemVat = parseFloat(item.vat_amount || 0) * ratio;

    newSubtotal += itemSubtotal;
    newVatTotal += itemVat;
    newTotalAmount += itemSubtotal + itemVat;
  }

  sale.subtotal = newSubtotal;
  sale.vat_total = newVatTotal;
  sale.total_amount = newTotalAmount;
  await sale.save();
};

const updateSaleStatus = async (saleId) => {
  const sale = await Sale.findByPk(saleId, {
    include: [
      { model: Return, as: "Returns" },
      { model: SaleItem, as: "items" },
    ],
  });
  if (!sale) return;

  const returns = sale.Returns || [];
  const items = sale.items || [];

  const hasPending = returns.some((r) => r.status === "PENDING");
  const hasApproved = returns.some((r) => r.status === "APPROVED");
  const hasRejected = returns.some((r) => r.status === "CANCELLED");

  // A sale is "fully refunded" when every line is refunded
  const allRefunded =
    items.length > 0 && items.every((item) => item.is_refunded);
  const someRefunded = items.some((item) => item.is_refunded);

  if (hasPending) sale.status = "PENDING_REFUND";
  else if (allRefunded) sale.status = "FULLY_REFUNDED";
  else if (someRefunded) sale.status = "PARTIALLY_REFUNDED";
  // partially refunded but all returns rejected
  else if (hasApproved && !hasRejected) sale.status = "PARTIALLY_REFUNDED";
  else if (hasRejected && !hasApproved) sale.status = "CANCELLED";
  else sale.status = "COMPLETED";

  await sale.save();
};

// Approve return
export const approveReturn = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    // Fallback: use authenticated user's id if approved_by not provided
    const approved_by = req.body.approved_by || req.user?.id;

    console.log(`[approveReturn] id=${id} approved_by=${approved_by}`);

    const returnRecord = await Return.findByPk(id, { transaction });

    if (!returnRecord) {
      await transaction.rollback();
      return res.status(404).json({ error: "Return not found" });
    }

    if (returnRecord.status !== "PENDING") {
      await transaction.rollback();
      return res.status(400).json({
        error: `Return already ${returnRecord.status.toLowerCase()}`,
      });
    }

    // Find the original sale item
    const originalSaleItem = await SaleItem.findOne({
      where: {
        sale_id: returnRecord.sale_id,
        product_id: returnRecord.product_id,
      },
      transaction,
    });

    if (!originalSaleItem) {
      await transaction.rollback();
      return res.status(400).json({
        error: "Original sale item not found for this return",
      });
    }

    // Restore stock
    const product = await Product.findByPk(returnRecord.product_id, {
      transaction,
    });

    if (!product) {
      await transaction.rollback();
      return res.status(400).json({ error: "Product not found" });
    }

    if (product.track_stock) {
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
          console.log(`[approveReturn] Restored to batch ${batch.id}`);
        } else {
          // Batch was deleted — fall back to new batch
          const newBatch = await ProductBatch.create(
            {
              product_id: product.id,
              batch_code: `RET-${returnRecord.id}-${Date.now()}`,
              buying_price:
                parseFloat(originalSaleItem.buying_price) ||
                parseFloat(product.buying_price) ||
                0,
              selling_price:
                parseFloat(originalSaleItem.unit_price) ||
                parseFloat(product.selling_price) ||
                0,
              stock_quantity: 0,
              is_active: true,
            },
            { transaction },
          );
          await newBatch.addStock(
            returnRecord.quantity,
            approved_by,
            `Return #${returnRecord.id} (missing batch, new batch created)`,
            transaction,
          );
        }
      } else {
        // No batch_id (pre-batch sale) → create new batch
        const newBatch = await ProductBatch.create(
          {
            product_id: product.id,
            batch_code: `RET-${returnRecord.id}-${Date.now()}`,
            buying_price:
              parseFloat(originalSaleItem.buying_price) ||
              parseFloat(product.buying_price) ||
              0,
            selling_price:
              parseFloat(originalSaleItem.unit_price) ||
              parseFloat(product.selling_price) ||
              0,
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
        console.log(`[approveReturn] Created new batch ${newBatch.id}`);
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
      console.log(`[approveReturn] Product stock synced to ${totalStock}`);
    }

    // Mark return as approved
    returnRecord.status = "APPROVED";
    returnRecord.approved_by = approved_by;
    await returnRecord.save({ transaction });

    // Mark sale item as refunded
    await originalSaleItem.update({ is_refunded: true }, { transaction });

    await transaction.commit();

    // Recompute sale totals + status (outside transaction, since these
    // mutate the sale based on all returns)
    await updateSaleTotals(returnRecord.sale_id);
    await updateSaleStatus(returnRecord.sale_id);

    const updatedReturn = await Return.findByPk(id, {
      include: [
        {
          model: Product,
          as: "Product", // depends on your association alias
          attributes: ["id", "name", "stock_quantity"],
        },
        {
          model: Sale,
          attributes: ["id", "status", "subtotal", "total_amount"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Return approved successfully",
      return: updatedReturn,
    });
  } catch (err) {
    await transaction.rollback();
    console.error("[approveReturn] ERROR:", err);
    res.status(500).json({
      error: "Failed to approve return",
      details: err.message,
    });
  }
};

// Reject return
export const rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by, rejection_reason } = req.body;

    const returnRecord = await Return.findByPk(id);
    console.log(`[rejectReturn] id=${id} rejected_by=${rejected_by}`);

    if (!returnRecord) {
      return res.status(404).json({ error: "Return not found" });
    }

    if (returnRecord.status !== "PENDING") {
      return res.status(400).json({ error: "Return is already processed" });
    }

    // Update return status
    returnRecord.status = "REJECTED";
    returnRecord.approved_by = rejected_by;
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
    console.error("[rejectReturn] ERROR :", err);
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
