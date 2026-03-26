import db from "../models/index.js";
import { Op, where } from "sequelize";
import { validationResult } from "express-validator";

const { Product, Category, SaleItem } = db;

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

    const where = {};

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

    const product = await Product.create({
      name,
      barcode,
      category_id,
      buying_price: buying_price ? parseFloat(buying_price) : 0,
      selling_price: parseFloat(selling_price),
      stock_quantity: track_stock === false ? 0 : parseInt(stock_quantity || 0),
      vat_category: vat_category || "STANDARD",
      expire_date: expire_date || null,
      description: description || null,
      supplier: supplier || null,
      min_stock: min_stock || 10,
      product_type: isConsumable ? "Consumable" : "NORMAL",
      track_stock: track_stock !== false,
      sku: `TGM-${Date.now()}`,
      is_active: true,
    });

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
   UPDATE PRODUCT
===================================================== */
export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    /* 🚫 Prevent duplicate barcode */
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

    await product.update(req.body);

    res.json({
      success: true,
      message: "Product updated successfully",
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
