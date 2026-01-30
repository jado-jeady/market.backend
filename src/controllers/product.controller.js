import db from '../models/index.js';
import { Op } from 'sequelize';
import { validationResult } from 'express-validator';

const { Product, Category } = db;

export const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category_id,
      low_stock = false
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Category filter
    if (category_id) {
      where.category_id = category_id;
    }

    // Low stock filter
    if (low_stock === 'true') {
      where.stock_quantity = {
        [Op.lte]: db.sequelize.col('low_stock_threshold')
      };
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({
      success: true,
      data: products,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id, {
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
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
      expiry_date,
      low_stock_threshold,
      is_active
    } = req.body;

    // Check if barcode exists
    const existingProduct = await Product.findOne({ where: { barcode } });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this barcode already exists'
      });
    }

    // Check if category exists
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category not found'
      });
    }

    const product = await Product.create({
      name,
      barcode,
      category_id,
      buying_price: parseFloat(buying_price),
      selling_price: parseFloat(selling_price),
      stock_quantity: parseInt(stock_quantity),
      vat_category: vat_category || 'STANDARD',
      expiry_date: expiry_date || null,
      low_stock_threshold: low_stock_threshold || 10,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if barcode is being updated and if it already exists
    if (updates.barcode && updates.barcode !== product.barcode) {
      const existingProduct = await Product.findOne({
        where: { barcode: updates.barcode }
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Product with this barcode already exists'
        });
      }
    }

    await product.update(updates);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product has sales
    const hasSales = await db.SaleItem.findOne({
      where: { product_id: id }
    });

    if (hasSales) {
      // Soft delete (deactivate) instead of hard delete
      await product.update({ is_active: false });
      return res.json({
        success: true,
        message: 'Product deactivated successfully (has existing sales)'
      });
    }

    // Hard delete if no sales
    await product.destroy();

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    const product = await Product.findOne({
      where: { barcode },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};