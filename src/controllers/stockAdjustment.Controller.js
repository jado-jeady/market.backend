import db from "../models/index.js";
import { Op } from "sequelize";

const { Product, ProductBatch, StockAdjustment, User } = db;

export const adjustStock = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { product_id, barcode, type, quantity, reason, batch_id } = req.body;
    const user_id = req.user.id;

    if (!type || !quantity || !reason) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "type, quantity, reason required" });
    }

    const qty = Number(quantity);
    if (qty <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    const product = barcode
      ? await Product.findOne({ where: { barcode }, transaction })
      : await Product.findByPk(product_id, { transaction });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.track_stock) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Product ${product.name} does not track stock.`,
      });
    }

    /* ============================================================
       IN: Add stock to a single batch
       - If batch_id given, add to that batch
       - Else, add to oldest active batch, or create a new one
    ============================================================ */
    if (type === "IN") {
      let targetBatch;

      if (batch_id) {
        targetBatch = await ProductBatch.findByPk(batch_id, { transaction });
        if (!targetBatch) {
          await transaction.rollback();
          return res.status(404).json({ message: "Batch not found" });
        }
      } else {
        targetBatch = await ProductBatch.findOne({
          where: { product_id: product.id, is_active: true },
          order: [
            ["expire_date", "ASC NULLS LAST"],
            ["received_date", "ASC"],
          ],
          transaction,
        });

        if (!targetBatch) {
          targetBatch = await ProductBatch.create(
            {
              product_id: product.id,
              batch_code: `ADJ-${product.sku || product.id}-${Date.now()}`,
              buying_price: product.buying_price || 0,
              selling_price: product.selling_price,
              stock_quantity: 0,
              is_active: true,
            },
            { transaction },
          );
        }
      }

      const result = await targetBatch.addStock(
        qty,
        user_id,
        reason,
        transaction,
      );

      const totalStock = await ProductBatch.sum("stock_quantity", {
        where: { product_id: product.id },
        transaction,
      });
      await product.update(
        { stock_quantity: totalStock || 0 },
        { transaction },
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Stock added successfully",
        data: {
          batch_id: targetBatch.id,
          batch_code: targetBatch.batch_code,
          previous: result.previous,
          new: result.next,
          total_product_stock: totalStock,
        },
      });
    }

    /* ============================================================
       OUT: Remove stock
       - If batch_id given, remove only from that batch (single)
       - Else, LIFO across multiple batches (newest first)
    ============================================================ */
    if (type === "OUT") {
      // Single batch removal (explicit batch_id given)
      if (batch_id) {
        const batch = await ProductBatch.findByPk(batch_id, { transaction });
        if (!batch) {
          await transaction.rollback();
          return res.status(404).json({ message: "Batch not found" });
        }
        if (batch.stock_quantity < qty) {
          await transaction.rollback();
          return res.status(400).json({
            message: `Not enough stock in this batch (${batch.stock_quantity} available)`,
          });
        }

        const result = await batch.consumeForSale(
          qty,
          user_id,
          reason,
          transaction,
        );
        const totalStock = await ProductBatch.sum("stock_quantity", {
          where: { product_id: product.id },
          transaction,
        });
        await product.update(
          { stock_quantity: totalStock || 0 },
          { transaction },
        );

        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: "Stock removed successfully",
          data: {
            batch_id: batch.id,
            batch_code: batch.batch_code,
            previous: result.previous,
            new: result.next,
            total_product_stock: totalStock,
          },
        });
      }

      // LIFO multi-batch removal (newest first)
      const batches = await ProductBatch.findAll({
        where: {
          product_id: product.id,
          is_active: true,
          stock_quantity: { [Op.gt]: 0 },
        },
        order: [
          ["received_date", "DESC"], // ⭐ NEWEST FIRST
          ["created_at", "DESC"],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const totalAvailable = batches.reduce(
        (sum, b) => sum + b.stock_quantity,
        0,
      );

      if (totalAvailable < qty) {
        await transaction.rollback();
        return res.status(400).json({
          message: `Not enough stock. Available: ${totalAvailable}, Requested: ${qty}`,
        });
      }

      let remaining = qty;
      const breakdown = [];

      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, batch.stock_quantity);
        if (take <= 0) continue;

        const result = await batch.consumeForSale(
          take,
          user_id,
          reason,
          transaction,
        );
        breakdown.push({
          batch_id: batch.id,
          batch_code: batch.batch_code,
          taken: take,
          previous: result.previous,
          new: result.next,
        });
        remaining -= take;
      }

      const totalStock = await ProductBatch.sum("stock_quantity", {
        where: { product_id: product.id },
        transaction,
      });
      await product.update(
        { stock_quantity: totalStock || 0 },
        { transaction },
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: `Removed ${qty} units (LIFO across ${breakdown.length} batch(es))`,
        data: {
          breakdown,
          total_product_stock: totalStock,
        },
      });
    }

    // Unknown type
    await transaction.rollback();
    return res
      .status(400)
      .json({ message: "Invalid type (must be IN or OUT)" });
  } catch (error) {
    await transaction.rollback();
    console.error("adjustStock error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getStockAdjustments = async (req, res) => {
  try {
    const adjustments = await StockAdjustment.findAll({
      include: [
        { model: Product, attributes: ["id", "name", "barcode"] },
        { model: User, attributes: ["id", "username"] },
        { model: ProductBatch, as: "batch", attributes: ["id", "batch_code"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 1000,
    });
    return res.status(200).json(adjustments);
  } catch (error) {
    console.error("Fetch Adjustment Error:", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve stock history" });
  }
};
