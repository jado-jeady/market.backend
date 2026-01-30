import db from '../models/index.js';
import { validationResult } from 'express-validator';

const { Sale, SaleItem, Product, User } = db;
import { Sequelize } from 'sequelize';

export const createSale = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { items, payment_method, customer_id } = req.body;
    const userId = req.user.id;

    // Generate invoice number (YYYYMMDD-XXXXX)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const lastSale = await Sale.findOne({
      where: {
        invoice_number: {
          [Sequelize.Op.like]: `${dateStr}-%`
        }
      },
      order: [['invoice_number', 'DESC']],
      transaction
    });

    let sequence = 1;
    if (lastSale) {
      const lastSeq = parseInt(lastSale.invoice_number.slice(-5));
      sequence = lastSeq + 1;
    }

    const invoiceNumber = `${dateStr}-${sequence.toString().padStart(5, '0')}`;

    // Validate and process items
    let subtotal = 0;
    let vatTotal = 0;
    const saleItems = [];

    for (const item of items) {
      const product = await Product.findByPk(item.product_id, { transaction });
      
      if (!product) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`
        });
      }

      if (product.stock_quantity < item.quantity) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity}`
        });
      }

      if (!product.is_active) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not active`
        });
      }

      // Calculate item totals
      const unitPrice = product.selling_price;
      const totalPrice = unitPrice * item.quantity;
      
      // Calculate VAT based on product VAT category
      let vatAmount = 0;
      if (product.vat_category === 'STANDARD') {
        // Assuming 18% VAT (you can make this configurable)
        vatAmount = totalPrice * 0.18;
      }

      subtotal += totalPrice;
      vatTotal += vatAmount;

      saleItems.push({
        product_id: product.id,
        quantity: item.quantity,
        unit_price: unitPrice,
        vat_amount: vatAmount,
        total_price: totalPrice
      });

      // Update product stock
      await product.update(
        {
          stock_quantity: product.stock_quantity - item.quantity
        },
        { transaction }
      );
    }

    const totalAmount = subtotal + vatTotal;

    // Create sale
    const sale = await Sale.create(
      {
        invoice_number: invoiceNumber,
        user_id: userId,
        customer_id: customer_id || null,
        subtotal,
        vat_total: vatTotal,
        total_amount: totalAmount,
        payment_method,
        status: 'COMPLETED'
      },
      { transaction }
    );

    // Create sale items
    const saleItemsWithSaleId = saleItems.map(item => ({
      ...item,
      sale_id: sale.id
    }));

    await SaleItem.bulkCreate(saleItemsWithSaleId, { transaction });

    // Commit transaction
    await transaction.commit();

    // Get sale with details
    const saleWithDetails = await Sale.findByPk(sale.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'username']
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'barcode', 'vat_category']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      data: saleWithDetails
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export const getAllSales = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      start_date,
      end_date,
      user_id,
      payment_method
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Date filter
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Sequelize.Op.gte] = new Date(start_date);
      }
      if (end_date) {
        where.created_at[Sequelize.Op.lte] = new Date(end_date);
      }
    }

    // User filter
    if (user_id) {
      where.user_id = user_id;
    }

    // Payment method filter
    if (payment_method) {
      where.payment_method = payment_method;
    }

    const { count, rows: sales } = await Sale.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name']
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: sales,
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

export const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'username']
        },
        {
          model: SaleItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'barcode', 'vat_category']
            }
          ]
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's sales
    const todaySales = await Sale.findAll({
      where: {
        created_at: {
          [Sequelize.Op.gte]: today
        },
        status: 'COMPLETED'
      },
      attributes: [
        [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total_sales'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'transaction_count']
      ],
      raw: true
    });

    // Sales by payment method
    const salesByPaymentMethod = await Sale.findAll({
      where: {
        created_at: {
          [Sequelize.Op.gte]: today
        },
        status: 'COMPLETED'
      },
      attributes: [
        'payment_method',
        [Sequelize.fn('SUM', Sequelize.col('total_amount')), 'total']
      ],
      group: ['payment_method'],
      raw: true
    });

    // Low stock products
    const lowStockProducts = await Product.findAll({
      where: {
        stock_quantity: {
          [Sequelize.Op.lte]: Sequelize.col('low_stock_threshold')
        },
        is_active: true
      },
      attributes: ['id', 'name', 'stock_quantity', 'low_stock_threshold'],
      limit: 10
    });

    res.json({
      success: true,
      data: {
        today_sales: todaySales[0] || { total_sales: 0, transaction_count: 0 },
        sales_by_payment_method: salesByPaymentMethod,
        low_stock_products: lowStockProducts
      }
    });
  } catch (error) {
    next(error);
  }
};