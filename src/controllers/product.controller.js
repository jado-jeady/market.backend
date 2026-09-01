import db from "../models/index.js";
import { Op, where } from "sequelize";
import { validationResult } from "express-validator";
import sequelize from "../config/database.js";
const { Product, Category, SaleItem, User, PriceChange } = db;

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
    }; // default filter to show only normal products, active, non-barista items and active products

    /* 🔎 SEARCH */
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    /* 📂 CATEGORY FILTER */
    if (category_id && category_id !== "all") {
      where.category_id = category_id;
    }

    /* 🧃 PRODUCT TYPE FILTER */
    if (product_type) {
      where.product_type = product_type;
    }

    /* 📉 LOW STOCK */
    if (low_stock === "true") {
      where.stock_quantity = {
        [Op.lte]: Product.sequelize.col("min_stock"),
      };
    }

    //out of stock
    if (out_of_stock === "true") {
      where.stock_quantity = {
        [Op.lte]: 0,
      };
    }

    /* 🟢 ACTIVE FILTER */
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
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
    });

    return res.json({
      success: true,
      data: rows,
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

/* =====================================================
   GET PRODUCT BY ID
===================================================== */
export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
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

    res.json({ success: true, data: product });
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

//     /* 🚫 Prevent duplicate barcode */
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
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Prevent duplicate barcode
    if (req.body.barcode && req.body.barcode !== product.barcode) {
      const exists = await Product.findOne({
        where: { barcode: req.body.barcode },
      });

      if (exists) {
        return res.status(400).json({
          success: false,
          message: "Barcode already exists",
        });
      }
    }

    // Store old price for price change tracking
    const oldPrice = parseFloat(product.selling_price);
    const newPrice = req.body.selling_price
      ? parseFloat(req.body.selling_price)
      : oldPrice;

    // Update product
    await product.update(req.body);

    // Track price change if selling price changed
    if (oldPrice !== newPrice) {
      await PriceChange.create({
        product_id: product.id,
        old_price: oldPrice,
        new_price: newPrice,
        price_difference: newPrice - oldPrice,
        changed_by: req.user.id,
        change_reason:
          req.body.change_reason || "Price updated via product edit",
        change_type: newPrice > oldPrice ? "INCREASE" : "DECREASE",
      });

      console.log(
        `💰 Price change for product ${product.id}: ${oldPrice} → ${newPrice} by user ${req.user.id}`,
      );
    }

    // Fetch the updated product with price changes
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
      message: "Product updated successfully",
      data: updatedProduct,
    });
  } catch (error) {
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
