import db from "../models/index.js";
import { Op, where } from "sequelize";
import { validationResult } from "express-validator";
import sequelize from "../config/database.js";
const { Product, Category, SaleItem, User, PriceChange, ProductBatch } = db;

/* =====================================================
    GET ALL PRODUCTS (WITH FILTERS + PAGINATION)
  ===================================================== */
export const getAllProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 10000);
    const offset = (page - 1) * limit;

    const {
      search,
      category_id,
      low_stock,
      out_of_stock,
      product_type,
      is_active,
    } = req.query;

    const where = {
      product_type: ["NORMAL", "Consumable", "Service"],
      is_active: true,
    };

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (category_id && category_id !== "all") {
      where.category_id = category_id;
    }

    if (product_type) {
      where.product_type = product_type;
    }

    if (low_stock === "true") {
      where.stock_quantity = {
        [Op.lte]: Product.sequelize.col("min_stock"),
      };
    }

    if (out_of_stock === "true") {
      where.stock_quantity = { [Op.lte]: 0 };
    }

    if (is_active !== undefined) {
      where.is_active = is_active === "true";
    } else {
      where.is_active = true;
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      distinct: true,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: ProductBatch,
          as: "batches",
          attributes: [
            "id",
            "batch_code",
            "buying_price",
            "selling_price",
            "stock_quantity",
            "expire_date",
            "received_date",
            "is_active",
          ],
          required: false,
          // Only pull active batches (we filter out zero-stock in JS)
          where: { is_active: true },
        },
      ],
    });

    // ⭐ Compute current shelf price from newest active batch
    const productsWithBatchPricing = rows.map((product) => {
      const plain = product.toJSON();

      // Filter to batches with actual stock
      const activeBatches = (plain.batches || []).filter(
        (b) => b.stock_quantity > 0,
      );

      // Newest batch wins for display price
      const newestBatch = activeBatches.sort(
        (a, b) => new Date(b.received_date) - new Date(a.received_date),
      )[0];

      return {
        ...plain,
        // Always overwrite selling_price / buying_price so existing UI works unchanged
        selling_price: newestBatch
          ? newestBatch.selling_price
          : plain.selling_price,
        buying_price: newestBatch
          ? newestBatch.buying_price
          : plain.buying_price,
        //  bonus: expose batch info for whoever needs it
        current_batch_id: newestBatch?.id || null,
        current_batch_code: newestBatch?.batch_code || null,
        current_batch_expiry: newestBatch?.expire_date || null,
        active_batches_count: activeBatches.length,
        total_batch_stock: activeBatches.reduce(
          (sum, b) => sum + b.stock_quantity,
          0,
        ),
      };
    });

    return res.json({
      success: true,
      data: productsWithBatchPricing,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    next(error);
  }
};

// helper fucntions
/**
 * Take a product (with batches already included) and return a plain object
 * with the newest active batch's price as selling_price/buying_price.
 */
const applyBatchPricing = (productInstance) => {
  const plain = productInstance.toJSON();
  const activeBatches = (plain.batches || []).filter(
    (b) => b.stock_quantity > 0,
  );
  const newestBatch = activeBatches.sort(
    (a, b) => new Date(b.received_date) - new Date(a.received_date),
  )[0];

  return {
    ...plain,
    selling_price: newestBatch
      ? newestBatch.selling_price
      : plain.selling_price,
    buying_price: newestBatch ? newestBatch.buying_price : plain.buying_price,
    current_batch_id: newestBatch?.id || null,
    current_batch_code: newestBatch?.batch_code || null,
    current_batch_expiry: newestBatch?.expire_date || null,
    active_batches_count: activeBatches.length,
    total_batch_stock: activeBatches.reduce(
      (sum, b) => sum + b.stock_quantity,
      0,
    ),
  };
};

/* =====================================================
    GET PRODUCT BY ID
  ===================================================== */
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        {
          model: ProductBatch,
          as: "batches",
          where: { is_active: true },
          required: false,
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({ success: true, data: applyBatchPricing(product) });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
    CREATE PRODUCT
  ===================================================== */
export const createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      name,
      barcode,
      category_id,
      buying_price,
      selling_price,
      stock_quantity,
      vat_category,
      expire_date,
      description,
      supplier,
      isConsumable,
      isBaristaItem,
      min_stock,
      product_type,
      track_stock,
    } = req.body;

    /* 🚫 Barcode must be unique */
    const existing = await Product.findOne({ where: { barcode } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Barcode already exists",
      });
    }

    /* 📂 Category must exist */
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    /* 🧾 Determine product type */
    let resolvedProductType = "NORMAL";
    if (isBaristaItem) {
      resolvedProductType = "Baristary";
    } else if (isConsumable) {
      resolvedProductType = "Consumable";
    }

    /* ☕ Barista items: limited fields, no stock tracking */
    const productData = isBaristaItem
      ? {
          name,
          barcode,
          category_id,
          selling_price: parseFloat(selling_price),
          buying_price: 0,
          stock_quantity: 0,
          track_stock: false,
          vat_category: vat_category || "STANDARD",
          expire_date: null,
          description: description || null,
          supplier: null,
          min_stock: 0,
          product_type: resolvedProductType,
          sku: `BAR-${Date.now()}`,
          is_active: true,
        }
      : {
          name,
          barcode,
          category_id,
          buying_price: buying_price ? parseFloat(buying_price) : 0,
          selling_price: parseFloat(selling_price),
          stock_quantity:
            track_stock === false ? 0 : parseInt(stock_quantity || 0),
          vat_category: vat_category || "STANDARD",
          expire_date: expire_date || null,
          description: description || null,
          supplier: supplier || null,
          min_stock: min_stock || 10,
          product_type: resolvedProductType,
          track_stock: track_stock !== false,
          sku: `TGM-${Date.now()}`,
          is_active: true,
        };

    const product = await Product.create(productData);

    // If product tracks stock and has initial qty, create its first batch
    if (product.track_stock && product.stock_quantity > 0) {
      await ProductBatch.create({
        product_id: product.id,
        batch_code: `INIT-${product.sku || product.id}-${Date.now()}`,
        buying_price: parseFloat(buying_price || 0),
        selling_price: parseFloat(selling_price),
        stock_quantity: parseInt(stock_quantity || 0),
        expire_date: expire_date || null,
        received_date: new Date(),
        is_active: true,
      });
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
    DELETE PRODUCT
  ===================================================== */
export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const hasSales = await SaleItem.findOne({
      where: { product_id: product.id },
    });

    if (hasSales) {
      await product.update({ is_active: false });

      return res.json({
        success: true,
        message: "Product deactivated (has sales history)",
      });
    }

    await product.destroy();

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
    GET PRODUCT BY BARCODE (POS SAFE)
  ===================================================== */

export const getProductByBarcode = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: {
        barcode: req.params.barcode,
        is_active: true,
      },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    /* 🚫 Prevent selling out-of-stock items */
    if (product.track_stock && product.stock_quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// get consumables
export const getAllConsumables = async (req, res, next) => {
  try {
    const { count, rows } = await Product.findAndCountAll({
      where: {
        is_active: true,
        product_type: "Consumable",
      },
      order: [["created_at", "DESC"]], // optional: keep results ordered
    });

    return res.status(200).json({
      success: true,
      message: "Consumables fetched successfully",
      count,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching consumables:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch consumables",
      error: error.message,
    });
  }
};

// get barista items
export const getAllBaristaItems = async (req, res, next) => {
  try {
    const { count, rows } = await Product.findAndCountAll({
      where: {
        is_active: true,
        product_type: "Baristary",
      },
      order: [["created_at", "DESC"]], // optional: keep results ordered
    });

    return res.status(200).json({
      success: true,
      message: "Barista items fetched successfully",
      count,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching barista items:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch barista items",
      error: error.message,
    });
  }
};

//#############################Price Change History#####################################

// /* =====================================================
//    UPDATE PRODUCT
// ===================================================== */
// export const updateProduct = async (req, res, next) => {
//   try {
//     const product = await Product.findByPk(req.params.id);

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found",
//       });
//     }

//     /*  Prevent duplicate barcode */
//     if (req.body.barcode && req.body.barcode !== product.barcode) {
//       const exists = await Product.findOne({
//         where: { barcode: req.body.barcode },
//       });

//       if (exists) {
//         return res.status(400).json({
//           success: false,
//           message: "Barcode already exists",
//         });
//       }
//     }

//     await product.update(req.body);

//     res.json({
//       success: true,
//       message: "Product updated successfully",
//       data: product,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const updateProduct = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const product = await Product.findByPk(req.params.id, { transaction });

    if (!product) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Prevent duplicate barcode
    if (req.body.barcode && req.body.barcode !== product.barcode) {
      const exists = await Product.findOne({
        where: { barcode: req.body.barcode },
        transaction,
      });
      if (exists) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: "Barcode already exists",
        });
      }
    }

    // Track price changes
    const oldPrice = parseFloat(product.selling_price);
    const newPrice = req.body.selling_price
      ? parseFloat(req.body.selling_price)
      : oldPrice;

    // Update product
    await product.update(req.body, { transaction });

    // ⭐ If selling price changed, sync all active non-zero batches
    let syncedBatches = [];
    if (oldPrice !== newPrice) {
      const batchesToSync = await ProductBatch.findAll({
        where: {
          product_id: product.id,
          is_active: true,
          stock_quantity: { [Op.gt]: 0 },
        },
        transaction,
      });

      for (const batch of batchesToSync) {
        const batchOldPrice = parseFloat(batch.selling_price);
        if (batchOldPrice === newPrice) continue; // already same, skip

        // ✅ ONE log row per batch (no product-level duplicate)
        await PriceChange.create(
          {
            product_id: product.id,
            old_price: batchOldPrice,
            new_price: newPrice,
            price_difference: newPrice - batchOldPrice,
            changed_by: req.user.id,
            change_reason:
              req.body.change_reason || "Price updated via product edit",
            change_type: newPrice > batchOldPrice ? "INCREASE" : "DECREASE",
            affected_batch_id: batch.id, // ← per-batch reference
          },
          { transaction },
        );

        await batch.update({ selling_price: newPrice }, { transaction });
        syncedBatches.push({
          batch_id: batch.id,
          batch_code: batch.batch_code,
          old_price: batchOldPrice,
          new_price: newPrice,
        });
      }

      // If there are NO active batches (product has 0 stock everywhere),
      // still log ONE product-level row so the price change isn't lost
      if (batchesToSync.length === 0) {
        await PriceChange.create(
          {
            product_id: product.id,
            old_price: oldPrice,
            new_price: newPrice,
            price_difference: newPrice - oldPrice,
            changed_by: req.user.id,
            change_reason:
              req.body.change_reason || "Price updated via product edit",
            change_type: newPrice > oldPrice ? "INCREASE" : "DECREASE",
            affected_batch_id: null,
          },
          { transaction },
        );
      }
    }

    await transaction.commit();

    // Return updated product with price history
    const updatedProduct = await Product.findByPk(req.params.id, {
      include: [
        {
          model: PriceChange,
          as: "price_changes",
          limit: 5,
          order: [["created_at", "DESC"]],
          include: [
            {
              model: User,
              as: "changedBy",
              attributes: ["id", "full_name", "email"],
            },
          ],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
    });

    res.json({
      success: true,
      message: syncedBatches.length
        ? `Product updated. ${syncedBatches.length} active batch(es) price-synced.`
        : "Product updated successfully",
      data: updatedProduct,
      synced_batches: syncedBatches,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Get price change history for a product
export const getProductPriceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const priceChanges = await PriceChange.findAndCountAll({
      where: { product_id: id },
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: User,
          as: "changedBy",
          attributes: ["id", "full_name", "email"],
        },
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
        },
      ],
    });

    res.json({
      success: true,
      data: priceChanges.rows,
      total: priceChanges.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Error fetching price history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch price history",
    });
  }
};

// Get price change summary for dashboard
export const getPriceChangeSummary = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));

    const [totalChanges, changesByType, recentChanges] = await Promise.all([
      PriceChange.count({
        where: {
          created_at: {
            [Op.gte]: dateLimit,
          },
        },
      }),
      PriceChange.findAll({
        attributes: [
          "change_type",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
        ],
        where: {
          created_at: {
            [Op.gte]: dateLimit,
          },
        },
        group: ["change_type"],
        raw: true,
      }),
      PriceChange.findAll({
        where: {
          created_at: {
            [Op.gte]: dateLimit,
          },
        },
        order: [["created_at", "DESC"]],
        limit: 10,
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name"],
          },
          {
            model: User,
            as: "changedBy",
            attributes: ["id", "full_name"],
          },
        ],
      }),
    ]);

    res.json({
      success: true,
      data: {
        total_changes: totalChanges,
        changes_by_type: changesByType,
        recent_changes: recentChanges,
      },
    });
  } catch (error) {
    console.error("Error fetching price change summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch price change summary",
    });
  }
};

// Get all price changes with filters
export const getAllPriceChanges = async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      product_id,
      change_type,
      start_date,
      end_date,
    } = req.query;

    const where = {};

    if (product_id) where.product_id = parseInt(product_id);
    if (change_type) where.change_type = change_type;

    if (start_date && end_date) {
      where.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)],
      };
    } else if (start_date) {
      where.created_at = {
        [Op.gte]: new Date(start_date),
      };
    } else if (end_date) {
      where.created_at = {
        [Op.lte]: new Date(end_date),
      };
    }

    const priceChanges = await PriceChange.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "sku"],
        },
        {
          model: User,
          as: "changedBy",
          attributes: ["id", "full_name", "email"],
        },
      ],
    });

    res.json({
      success: true,
      data: priceChanges.rows,
      total: priceChanges.count,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Error fetching price changes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch price changes",
    });
  }
};

/* =====================================================
    GET ALL BATCHES FOR A PRODUCT
  ===================================================== */
export const getProductBatches = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const batches = await ProductBatch.findAll({
      where: { product_id: req.params.id },
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, data: batches });
  } catch (error) {
    next(error);
  }
};

/* =====================================================
    RECEIVE NEW STOCK (create a new batch + sync prices)
  ===================================================== */
export const receiveStock = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const {
      product_id,
      quantity,
      buying_price,
      selling_price,
      expire_date,
      update_existing_batches = true, // default: auto-sync shelf price
      change_reason,
    } = req.body;

    const user_id = req.user.id;

    // ---- 1. Validate product ----
    const product = await Product.findByPk(product_id, { transaction });
    if (!product) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    if (!product.track_stock) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Product does not track stock",
      });
    }

    if (!buying_price || !selling_price) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "buying_price and selling_price are required",
      });
    }

    const newBuying = parseFloat(buying_price);
    const newSelling = parseFloat(selling_price);

    // ---- 2. Create the new batch ----
    const batchCode = `${product.sku || product.id}-${Date.now()}`;

    const newBatch = await ProductBatch.create(
      {
        product_id: product.id,
        batch_code: batchCode,
        buying_price: newBuying,
        selling_price: newSelling,
        stock_quantity: 0,
        expire_date: expire_date || null,
        received_date: new Date(),
        is_active: true,
      },
      { transaction },
    );

    // ---- 3. Add the incoming quantity (auto-logs stock_adjustment) ----
    await newBatch.addStock(
      parseInt(quantity),
      user_id,
      `New batch received: ${batchCode}`,
      transaction,
    );

    // ---- 4. Auto-sync selling price on OTHER active batches ----
    // If the new selling price differs from existing batches, update them
    // AND log each change in price_changes for audit trail.
    let updatedBatches = [];
    if (update_existing_batches) {
      const otherBatches = await ProductBatch.findAll({
        where: {
          product_id: product.id,
          is_active: true,
          stock_quantity: { [Op.gt]: 0 }, // only non-zero stock
          id: { [Op.ne]: newBatch.id }, // exclude the new one
        },
        transaction,
      });

      for (const batch of otherBatches) {
        const oldSelling = parseFloat(batch.selling_price);
        if (oldSelling === newSelling) continue; // already same, skip

        // Log the price change for this specific batch
        await PriceChange.create(
          {
            product_id: product.id,
            old_price: oldSelling,
            new_price: newSelling,
            price_difference: newSelling - oldSelling,
            changed_by: user_id,
            change_reason:
              change_reason ||
              `Auto-synced with new batch ${batchCode} (shelf price update)`,
            change_type: newSelling > oldSelling ? "INCREASE" : "DECREASE",
            affected_batch_id: batch.id,
          },
          { transaction },
        );

        // Update only the selling price (keep buying_price frozen)
        await batch.update({ selling_price: newSelling }, { transaction });

        updatedBatches.push({
          batch_id: batch.id,
          batch_code: batch.batch_code,
          old_selling_price: oldSelling,
          new_selling_price: newSelling,
        });
      }
    }
    // If no other batches existed, log a product-level change so price history isn't empty
    if (update_existing_batches && updatedBatches.length === 0) {
      const oldProductSelling = parseFloat(product.selling_price);
      if (oldProductSelling !== newSelling) {
        await PriceChange.create(
          {
            product_id: product.id,
            old_price: oldProductSelling,
            new_price: newSelling,
            price_difference: newSelling - oldProductSelling,
            changed_by: user_id,
            change_reason:
              change_reason ||
              `Product shelf price updated via new batch ${batchCode}`,
            change_type:
              newSelling > oldProductSelling ? "INCREASE" : "DECREASE",
            affected_batch_id: null,
          },
          { transaction },
        );
      }
    }

    // ---- 5. Update product cached stock + default prices ----
    const totalStock = await ProductBatch.sum("stock_quantity", {
      where: { product_id: product.id },
      transaction,
    });

    await product.update(
      {
        stock_quantity: totalStock || 0,
        buying_price: newBuying, // update default for future references
        selling_price: newSelling, // update default for future references
        supplier: req.body.supplier || product.supplier,
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: updatedBatches.length
        ? `Batch received and ${updatedBatches.length} existing batch(es) price-synced`
        : "Batch received",
      data: {
        new_batch: newBatch,
        synced_batches: updatedBatches,
        total_product_stock: totalStock,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/* =====================================================
   GET ALL BATCHES (with filters + pagination)
===================================================== */
export const getAllBatches = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      product_id,
      status, // "active" | "inactive" | "expired" | "expiring_soon"
      low_stock,
      sort_by = "received_date",
      sort_order = "DESC",
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const productWhere = {};

    if (product_id) {
      where.product_id = product_id;
    }

    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    if (status === "active") {
      where.is_active = true;
      where.stock_quantity = { [Op.gt]: 0 };
    } else if (status === "inactive") {
      where.is_active = false;
    } else if (status === "expired") {
      where.expire_date = { [Op.lt]: today };
      where.stock_quantity = { [Op.gt]: 0 };
    } else if (status === "expiring_soon") {
      where.expire_date = { [Op.between]: [today, soon] };
      where.stock_quantity = { [Op.gt]: 0 };
    }

    if (low_stock === "true") {
      where.stock_quantity = { [Op.gt]: 0, [Op.lte]: 10 };
    }

    // Validate sort fields (whitelist to prevent SQL injection)
    const allowedSort = [
      "received_date",
      "expire_date",
      "stock_quantity",
      "selling_price",
      "buying_price",
      "created_at",
    ];
    const sortField = allowedSort.includes(sort_by) ? sort_by : "received_date";
    const sortDir = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await ProductBatch.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [[sortField, sortDir]],
      distinct: true,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "sku", "min_stock"],
          where: Object.keys(productWhere).length ? productWhere : undefined,
          required: true,
        },
      ],
    });

    // Augment each batch with computed flags
    const batches = rows.map((b) => {
      const plain = b.toJSON();
      const expireDate = plain.expire_date ? new Date(plain.expire_date) : null;
      return {
        ...plain,
        is_expired: expireDate ? expireDate < today : false,
        is_expiring_soon: expireDate
          ? expireDate >= today && expireDate <= soon
          : false,
        is_low_stock: plain.stock_quantity <= (plain.product?.min_stock || 10),
        total_value:
          parseFloat(plain.stock_quantity) * parseFloat(plain.buying_price),
      };
    });

    return res.json({
      success: true,
      data: batches,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("getAllBatches error:", error);
    next(error);
  }
};

/* =====================================================
   GET PRODUCTS WITH THEIR BATCHES (grouped, paginated)
   Pagination is on PRODUCTS, not batches.
===================================================== */
export const getProductsWithBatches = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category_id,
      status,
      sort_by = "name",
      sort_order = "ASC",
    } = req.query;

    const offset = (page - 1) * limit;
    const today = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);

    const productWhere = {
      is_active: true,
      track_stock: true,
    };

    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (category_id && category_id !== "all") {
      productWhere.category_id = category_id;
    }

    // ⭐ Batch filter — applied to the JOIN, not post-filter
    const batchWhere = {
      is_active: true,
      stock_quantity: { [Op.gt]: 0 },
    };
    let requireBatch = false;

    if (status === "has_active") {
      requireBatch = true;
    } else if (status === "expired") {
      requireBatch = true;
      batchWhere.expire_date = { [Op.lt]: today };
    } else if (status === "expiring_soon") {
      requireBatch = true;
      batchWhere.expire_date = { [Op.between]: [today, soon] };
    } else if (status === "low_stock") {
      // Low stock is a product-level check on total stock
      // We'll handle it after fetching
    }

    const allowedSort = [
      "name",
      "stock_quantity",
      "created_at",
      "selling_price",
    ];
    const sortField = allowedSort.includes(sort_by) ? sort_by : "name";
    const sortDir = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const { count, rows: products } = await Product.findAndCountAll({
      where: productWhere,
      limit: parseInt(limit),
      offset,
      order: [[sortField, sortDir]],
      distinct: true, // ← REQUIRED when using hasMany include
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: ProductBatch,
          as: "batches",
          required: requireBatch, // ⭐ INNER JOIN when filtering by batch
          where: requireBatch ? batchWhere : undefined,
        },
      ],
    });

    const productIds = products.map((p) => p.id);

    // Fetch ALL batches for those products (for display, not filtering)
    const allBatches = await ProductBatch.findAll({
      where: { product_id: { [Op.in]: productIds } },
      order: [
        ["received_date", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    const batchesByProduct = {};
    for (const batch of allBatches) {
      if (!batchesByProduct[batch.product_id]) {
        batchesByProduct[batch.product_id] = [];
      }
      batchesByProduct[batch.product_id].push(batch);
    }

    let result = products.map((product) => {
      const plain = product.toJSON();
      const batches = (batchesByProduct[product.id] || []).map((b) => {
        const bj = b.toJSON();
        const expireDate = bj.expire_date ? new Date(bj.expire_date) : null;
        return {
          ...bj,
          is_expired: expireDate ? expireDate < today : false,
          is_expiring_soon: expireDate
            ? expireDate >= today && expireDate <= soon
            : false,
        };
      });

      const activeBatches = batches.filter(
        (b) => b.stock_quantity > 0 && b.is_active,
      );

      const totalStock = activeBatches.reduce(
        (sum, b) => sum + b.stock_quantity,
        0,
      );

      const totalValue = activeBatches.reduce(
        (sum, b) => sum + b.stock_quantity * parseFloat(b.buying_price || 0),
        0,
      );

      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;
      const expiringSoonCount = activeBatches.filter(
        (b) => b.is_expiring_soon,
      ).length;
      const expiredCount = activeBatches.filter((b) => b.is_expired).length;
      const lowStock = totalStock > 0 && totalStock <= (plain.min_stock || 10);

      return {
        ...plain,
        batches,
        batch_count: batches.length,
        active_batch_count: activeBatches.length,
        total_batch_stock: totalStock,
        average_cost: Math.round(avgCost * 100) / 100,
        has_expiring_soon: expiringSoonCount > 0,
        expiring_soon_count: expiringSoonCount,
        has_expired: expiredCount > 0,
        expired_count: expiredCount,
        is_low_stock: lowStock,
        selling_price: activeBatches[0]?.selling_price || plain.selling_price,
        buying_price: activeBatches[0]?.buying_price || plain.buying_price,
      };
    });

    // Low stock still needs post-filter (aggregate-based)
    if (status === "low_stock") {
      result = result.filter((p) => p.is_low_stock);
    }

    return res.json({
      success: true,
      data: result,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("getProductsWithBatches error:", error);
    next(error);
  }
};

/* =====================================================
   EXPIRY REPORT — flat list of expiring/expired batches
===================================================== */
export const getExpiryReport = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      range = "30", // "expired" | "7" | "30" | "90" | "all"
      search,
      category_id,
    } = req.query;

    const offset = (page - 1) * limit;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where = {
      is_active: true,
      stock_quantity: { [Op.gt]: 0 },
      expire_date: { [Op.ne]: null }, // must have an expiry date
    };

    if (range === "expired") {
      where.expire_date = { [Op.lt]: today };
    } else if (range === "7") {
      const d = new Date(today);
      d.setDate(d.getDate() + 7);
      where.expire_date = { [Op.between]: [today, d] };
    } else if (range === "30") {
      const d = new Date(today);
      d.setDate(d.getDate() + 30);
      where.expire_date = { [Op.between]: [today, d] };
    } else if (range === "90") {
      const d = new Date(today);
      d.setDate(d.getDate() + 90);
      where.expire_date = { [Op.between]: [today, d] };
    } else if (range === "all") {
      // any expiry date in the future OR past — no upper bound
      // (we already filter for expire_date != null)
    }

    const productWhere = { is_active: true };
    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
      ];
    }
    if (category_id && category_id !== "all") {
      productWhere.category_id = category_id;
    }

    const { count, rows: batches } = await ProductBatch.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [["expire_date", "ASC"]], // soonest first
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode", "sku", "category_id"],
          where: productWhere,
          required: true,
          include: [
            {
              model: Category,
              as: "category",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
    });

    // Summary across ALL batches (not just this page)
    const allMatching = await ProductBatch.findAll({
      where,
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "min_stock"],
          where: productWhere,
          required: true,
        },
      ],
    });

    const soon7 = new Date(today);
    soon7.setDate(soon7.getDate() + 7);
    const soon30 = new Date(today);
    soon30.setDate(soon30.getDate() + 30);

    const summary = {
      total_batches: allMatching.length,
      total_units: 0,
      total_value: 0,
      expired_count: 0,
      expired_value: 0,
      in_7d_count: 0,
      in_7d_value: 0,
      in_30d_count: 0,
      in_30d_value: 0,
    };

    for (const b of allMatching) {
      const qty = b.stock_quantity;
      const val = qty * parseFloat(b.buying_price || 0);
      summary.total_units += qty;
      summary.total_value += val;

      const exp = new Date(b.expire_date);
      if (exp < today) {
        summary.expired_count += 1;
        summary.expired_value += val;
      } else if (exp <= soon7) {
        summary.in_7d_count += 1;
        summary.in_7d_value += val;
      } else if (exp <= soon30) {
        summary.in_30d_count += 1;
        summary.in_30d_value += val;
      }
    }

    // Augment each row with days_left
    const data = batches.map((b) => {
      const plain = b.toJSON();
      const exp = plain.expire_date ? new Date(plain.expire_date) : null;
      const daysLeft = exp
        ? Math.ceil((exp - today) / (1000 * 60 * 60 * 24))
        : null;
      return {
        ...plain,
        days_left: daysLeft,
        is_expired: exp ? exp < today : false,
        total_value: plain.stock_quantity * parseFloat(plain.buying_price || 0),
      };
    });

    return res.json({
      success: true,
      data,
      summary,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error("getExpiryReport error:", error);
    next(error);
  }
};
