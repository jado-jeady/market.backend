import db from "../models/index.js";
import { validationResult } from "express-validator";

import { Sequelize, Op } from "sequelize";
import sequelize from "../config/database.js";

const { Sale, SaleItem, Product, Shift, User } = db;

// Create a new sale
export const createSale = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();

  try {
    // 🐛 FIXED: was validationResult(req.body) — should be req
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await transaction.rollback();
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { saleType, items, payment_method, customer_id } = req.body;
    const userId = req.user.id;

    // Invoice number generation (unchanged logic)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const lastSale = await Sale.findOne({
      where: { invoice_number: { [Sequelize.Op.like]: `${dateStr}-%` } },
      order: [["invoice_number", "DESC"]],
      transaction,
    });
    let sequence = lastSale
      ? parseInt(lastSale.invoice_number.slice(-5)) + 1
      : 1;
    const invoiceNumber = `${dateStr}-${sequence.toString().padStart(5, "0")}`;

    const isBarista = saleType === "baristaSales" || saleType === "baristaSale";

    let subtotal = 0;
    let vatTotal = 0;
    const saleItems = [];

    for (const item of items) {
      // ============ BARISTA: no stock, no batches ============
      if (isBarista) {
        const quantity = Number(item.quantity) || 1;
        const unitPrice = parseFloat(item.price) || 0;
        const totalPrice = unitPrice * quantity;
        const vatAmount = item.vat_amount ? parseFloat(item.vat_amount) : 0;

        subtotal += totalPrice;
        vatTotal += vatAmount;

        saleItems.push({
          product_id: item.product_id || null,
          quantity,
          unit_price: unitPrice,
          product_name: item.name || `Item ${item.product_id || ""}`,
          barcode: item.barcode || null,
          vat_amount: vatAmount,
          total_price: totalPrice,
          with_bottle: item.with_bottle || false,
          bottle_price: parseFloat(item.bottle_price) || 0,
          batch_id: null,
          buying_price: 0,
          profit_margin: 0,
        });
        continue;
      }

      // ============ REGULAR PRODUCT SALE ============
      const product = await Product.findByPk(item.product_id, { transaction });

      if (!product) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: `Product with ID ${item.product_id} not found`,
        });
      }

      if (!product.is_active) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not active`,
        });
      }

      // Products that don't track stock (services): no batches
      if (!product.track_stock) {
        const unitPrice = parseFloat(product.selling_price);
        const totalPrice = unitPrice * item.quantity;
        const vatAmount =
          product.vat_category === "STANDARD" ? totalPrice * 0.18 : 0;

        subtotal += totalPrice;
        vatTotal += vatAmount;

        saleItems.push({
          product_id: product.id,
          quantity: item.quantity,
          unit_price: unitPrice,
          product_name: product.name,
          barcode: product.barcode,
          vat_amount: vatAmount,
          total_price: totalPrice,
          with_bottle: item.with_bottle || false,
          bottle_price: parseFloat(item.bottle_price) || 0,
          batch_id: null,
          buying_price: 0,
          profit_margin: 0,
        });
        continue;
      }

      // ⭐ FIFO: oldest expiring batch first
      const batches = await ProductBatch.findAll({
        where: {
          product_id: product.id,
          is_active: true,
          stock_quantity: { [Op.gt]: 0 },
        },
        order: [
          ["expire_date", "ASC NULLS LAST"],
          ["received_date", "ASC"],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (batches.length === 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `No stock available for ${product.name}`,
        });
      }

      let remainingQty = item.quantity;
      const bottlePrice = parseFloat(item.bottle_price) || 0;

      for (const batch of batches) {
        if (remainingQty <= 0) break;

        const take = Math.min(remainingQty, batch.stock_quantity);
        const unitPrice =
          parseFloat(batch.selling_price) +
          (item.with_bottle ? bottlePrice : 0);
        const buyingPrice = parseFloat(batch.buying_price);
        const lineTotal = unitPrice * take;
        const lineCost = buyingPrice * take;
        const vatAmount =
          product.vat_category === "STANDARD" ? lineTotal * 0.18 : 0;

        // Consume from batch + auto-log stock_adjustment
        await batch.consumeForSale(
          take,
          userId,
          `Sale #${invoiceNumber}`,
          transaction,
        );

        saleItems.push({
          product_id: product.id,
          batch_id: batch.id,
          quantity: take,
          unit_price: unitPrice,
          buying_price: buyingPrice,
          profit_margin: lineTotal - lineCost,
          product_name: item.with_bottle
            ? `${product.name} (+ Bottle)`
            : product.name,
          barcode: product.barcode,
          vat_amount: vatAmount,
          total_price: lineTotal,
          with_bottle: item.with_bottle || false,
          bottle_price: bottlePrice,
        });

        subtotal += lineTotal;
        vatTotal += vatAmount;
        remainingQty -= take;
      }

      if (remainingQty > 0) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }

      // Sync cached total on product
      const totalStock = await ProductBatch.sum("stock_quantity", {
        where: { product_id: product.id },
        transaction,
      });
      await product.update(
        { stock_quantity: totalStock || 0 },
        { transaction },
      );
    }

    const totalAmount = subtotal + vatTotal;

    const sale = await Sale.create(
      {
        invoice_number: invoiceNumber,
        user_id: userId,
        customer_id: customer_id || null,
        customer_name: req.body.customer_name || null,
        customer_phone: req.body.customer_phone || null,
        subtotal,
        shift_id: req.body.shift_id,
        vat_total: vatTotal,
        total_amount: totalAmount,
        payment_method,
        status: "COMPLETED",
        is_barista: isBarista,
      },
      { transaction },
    );

    const saleItemsWithSaleId = saleItems.map((item) => ({
      ...item,
      sale_id: sale.id,
    }));

    await SaleItem.bulkCreate(saleItemsWithSaleId, { transaction });

    await transaction.commit();

    const saleWithDetails = await Sale.findByPk(sale.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "username"],
        },
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "barcode", "vat_category"],
            },
            {
              model: ProductBatch,
              as: "batch",
              attributes: ["id", "batch_code", "buying_price", "selling_price"],
            },
          ],
        },
      ],
    });

    res.status(201).json({
      success: true,
      message: "Sale completed successfully",
      data: saleWithDetails,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Get all sales
export const getAllSales = async (req, res, next) => {
  try {
    let {
      page,
      limit,
      start_date,
      end_date,
      cashier_id,
      payment_method,
      status,
      shift_id,
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 3000;
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    /* Date filter (normalize to full day range) */
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Op.gte] = new Date(`${start_date}T00:00:00`);
      }
      if (end_date) {
        where.created_at[Op.lte] = new Date(`${end_date}T23:59:59`);
      }
    }

    /* Cashier filter */
    if (cashier_id) {
      where.user_id = cashier_id;
    }

    /* Payment method filter */
    if (payment_method) {
      where.payment_method = payment_method;
    }

    /* Status filter */
    if (status) {
      where.status = status;
    }

    /* Shift filter */
    if (shift_id) {
      where.shift_id = shift_id;
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name"],
        },
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Product, as: "product" }],
        },
        {
          model: Shift,
          as: "shift",
          attributes: ["id", "business_date", "status"],
        },
      ],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error("GetAllSales error:", error);
    next(error);
  }
};

// Get my sales - accessible by both ADMIN and CASHIER
export const getMySales = async (req, res, next) => {
  try {
    let { page, limit, start_date, end_date, payment_method, status } =
      req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || Number.MAX_SAFE_INTEGER;
    const offset = (pageNum - 1) * limitNum;

    // Getting cashier ID from token (NOT from query) for security reason
    const cashierId = req.user.id;

    if (!cashierId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const where = {
      user_id: cashierId,
    };

    /* ================= DATE FILTER ================= */
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }
    /* ================= PAYMENT FILTER ================= */
    if (payment_method) {
      where.payment_method = payment_method;
    }
    /* ================= STATUS FILTER ================= */
    if (status) {
      where.status = status.toUpperCase();
    }
    /* ================= FETCH ================= */
    const { count, rows } = await Sale.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name"],
        },
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "id",
                "name",
                "barcode",
                "selling_price",
                "description",
              ],
            },
          ],
        },
      ],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error("Get my sales error:", error);
    next(error);
  }
};

// Get sale by id
export const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "username"],
        },
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "barcode", "vat_category"],
            },
          ],
        },
      ],
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

// getting sales summary
export const getSalesSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's sales
    const todaySales = await Sale.findAll({
      where: {
        created_at: {
          [Sequelize.Op.gte]: today,
        },
        status: "COMPLETED",
      },
      attributes: [
        [Sequelize.fn("SUM", Sequelize.col("total_amount")), "total_sales"],
        [Sequelize.fn("COUNT", Sequelize.col("id")), "transaction_count"],
      ],
      raw: true,
    });

    // Sales by payment method
    const salesByPaymentMethod = await Sale.findAll({
      where: {
        created_at: {
          [Sequelize.Op.gte]: today,
        },
        status: "COMPLETED",
      },
      attributes: [
        "payment_method",
        [Sequelize.fn("SUM", Sequelize.col("total_amount")), "total"],
      ],
      group: ["payment_method"],
      raw: true,
    });

    // Low stock products
    const lowStockProducts = await Product.findAll({
      where: {
        stock_quantity: {
          [Sequelize.Op.lte]: Sequelize.col("low_stock_threshold"),
        },
        is_active: true,
      },
      attributes: ["id", "name", "stock_quantity", "low_stock_threshold"],
      limit: 10,
    });

    res.json({
      success: true,
      data: {
        today_sales: todaySales[0] || { total_sales: 0, transaction_count: 0 },
        sales_by_payment_method: salesByPaymentMethod,
        low_stock_products: lowStockProducts,
      },
    });
  } catch (error) {
    next(error);
  }
};

//geting sales by shift_id
export const getCashierSalesByashiftDate = async (req, res, next) => {
  try {
    const { business_date } = req.params;
    const cashierId = req.user.id; // Get the logged-in cashier's ID

    // If no date provided, default to today
    let dbDate;
    if (business_date) {
      const parsed = new Date(business_date);
      if (isNaN(parsed.getTime())) {
        throw new Error("Invalid date format");
      }
      dbDate = parsed.toISOString().split("T")[0]; // YYYY-MM-DD
    } else {
      dbDate = new Date().toISOString().split("T")[0]; // today
    }

    const sales = await Sale.findAll({
      where: { user_id: cashierId }, // Filter by the specific cashier
      include: [
        {
          model: Shift,
          as: "shift",
          attributes: ["business_date"],
          where: { business_date: dbDate }, // Filter by the shift date
          required: true,
        },
        {
          model: SaleItem,
          as: "items", // Include items to show what was sold
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["name", "barcode"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]], // Show latest sales first
    });

    if (!sales || sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No sales found for ${business_date}`,
      });
    }

    return res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error("Error fetching cashier sales by date:", error);
    next(error);
  }
};

// Getting Baristas sales
export const getBaristaSales = async (req, res, next) => {
  try {
    const baristaId = req.user.id;
    const sales = await Sale.findAll({
      where: { user_id: baristaId },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["id", "name", "barcode"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    next(error);
  }
};
