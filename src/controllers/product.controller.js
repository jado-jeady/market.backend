import db from '../models/index.js';
import { Op } from 'sequelize';
import { validationResult } from 'express-validator';

const { Product, Category } = db;



export const getAllProducts = async (req, res, next) => {
  try {
    // 1. Parse and sanitize all query parameters immediately
    // If they aren't numbers, provide safe defaults (1 and 100)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 100);
    const search = req.query.search || '';
    const category_id = req.query.category_id;
    const low_stock = req.query.low_stock;

    // 2. Safe calculation for OFFSET (Prevents "column NaN" error)
    const offset = (page - 1) * limit;
    
    const where = {};

    // 3. Dynamic Search Filtering
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // 4. Category Filtering
    if (category_id && category_id !== 'all') {
      where.category_id = category_id;
    }

    // 5. Low Stock Logic
    // Uses Sequelize.col to compare stock against its own min_stock threshold
    if (low_stock === 'true') {
      where.stock_quantity = {
        [Op.lte]: Product.sequelize.col('min_stock')
      };
    }

    // 6. Execute Query with Includes
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    });

    // 7. Structured Response
    res.json({
      success: true,
      data: products,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error("Error in getAllProducts:", error);
    // Pass the error to your global error handler
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
      expire_date,
      description,
      supplier,
      min_stock,
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

    console.log('Creating product with data:', {
      name,
      barcode,
      category_id,
      buying_price,
      selling_price,
      stock_quantity,
      vat_category,
      expire_date,
      min_stock,
      description,
      supplier
    });

    const product = await Product.create({
      name,
      barcode,
      category_id,
      buying_price: parseFloat(buying_price),
      selling_price: parseFloat(selling_price),
      stock_quantity: parseInt(stock_quantity),
      vat_category: vat_category || 'STANDARD',
      expire_date: expire_date || null,
      description: description || null,
      supplier: supplier || null,
      min_stock: min_stock,
      sku: `TGM-${Date.now()}`, // Simple SKU generation, can be improved
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
    console.log(req.body)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    

    const { id } = req.params;
    const updates = req.body;
    console.log(updates)

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