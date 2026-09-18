import db from "../models/index.js";
import { Op } from "sequelize";

const { Product, ProductBatch, StockAdjustment, User } = db;

export const adjustStock = async (req, res) => {
  console.log("adjustStock called with body:", req.body);
  const transaction = await db.sequelize.transaction();
  try {
    const { product_id, barcode, type, quantity, reason, batch_id } = req.body;
    const user_id = req.user.id;

    if (!type || !quantity || !reason) {
      return res
        .status(400)
        .json({ message: "type, quantity, reason required" });
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

    let targetBatch;

    if (batch_id) {
      targetBatch = await ProductBatch.findByPk(batch_id, { transaction });
      if (!targetBatch) {
        await transaction.rollback();
        return res.status(404).json({ message: "Batch not found" });
      }
    } else {
      // Fall back to oldest active batch
      targetBatch = await ProductBatch.findOne({
        where: { product_id: product.id, is_active: true },
        order: [
          ["expire_date", "ASC NULLS LAST"],
          ["received_date", "ASC"],
        ],
        transaction,
      });

      if (!targetBatch && type === "OUT") {
        await transaction.rollback();
        return res.status(400).json({
          message: "No active batch for this product. Cannot remove stock.",
        });
      }

      if (!targetBatch && type === "IN") {
        // Create a new batch on the fly for positive adjustments
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

    const result =
      type === "IN"
        ? await targetBatch.addStock(
            Number(quantity),
            user_id,
            reason,
            transaction,
          )
        : await targetBatch.consumeForSale(
            Number(quantity),
            user_id,
            `Adjustment: ${reason}`,
            transaction,
          );

    const totalStock = await ProductBatch.sum("stock_quantity", {
      where: { product_id: product.id },
      transaction,
    });
    await product.update({ stock_quantity: totalStock || 0 }, { transaction });

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        batch_id: targetBatch.id,
        batch_code: targetBatch.batch_code,
        previous: result.previous,
        new: result.next,
        total_product_stock: totalStock,
      },
    });
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
