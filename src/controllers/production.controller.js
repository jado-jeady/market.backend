import db from '../models/index.js';
import { Op } from 'sequelize';

const { Production, ProductionItem, Product, User, sequelize } = db;

/* =========================================================
   1️⃣ STOREKEEPER - SUBMIT PRODUCTION (PENDING)
========================================================= */
export const createProduction = async (req, res, next) => {
  try {
    const { items } = req.body;
    console.log(items);

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No production items provided'
      });
    }

    const production = await sequelize.transaction(async (t) => {

      const newProduction = await Production.create({
        status: 'PENDING',
        submitted_by: req.user.id,
      }, { transaction: t });

      for (const item of items) {
        const product = await Product.findByPk(item.product_id);

        if (!product) {
          throw new Error(`Product ID ${item.product_id} not found`);
        }

        await ProductionItem.create({
          production_id: newProduction.id,
          product_id: item.product_id,
          quantity: item.quantity,
          production_time: item.production_time || null,
          notes: item.notes || null,
        }, { transaction: t });
      }

      return newProduction;
    });

    res.status(201).json({
      success: true,
      message: 'Production submitted and pending approval',
      data: production
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   2️⃣ CASHIER - APPROVE PRODUCTION
   (Stock gets increased inside transaction)
========================================================= */
export const approveProduction = async (req, res, next) => {
  try {
    const { approval_note } = req.body;
    const { id } = req.params;

    const production = await Production.findByPk(id, {
      include: { model: ProductionItem, as: 'items' }
    });

    if (!production) {
      return res.status(404).json({
        success: false,
        message: 'Production not found'
      });
    }

    if (production.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending productions can be approved'
      });
    }

    await sequelize.transaction(async (t) => {

      for (const item of production.items) {
        const product = await Product.findByPk(item.product_id);

        if (product.track_stock) {
          product.stock_quantity += item.quantity;
          await product.save({ transaction: t });
        }
      }

      production.status = 'APPROVED';
      production.approved_by = req.user.id;
      production.approved_at = new Date();
      production.approval_note = approval_note || null;

      await production.save({ transaction: t });
    });

    res.json({
      success: true,
      message: 'Production approved and stock updated'
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   3️⃣ CASHIER - REJECT PRODUCTION
========================================================= */
export const rejectProduction = async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    const { id } = req.params;

    const production = await Production.findByPk(id);

    if (!production) {
      return res.status(404).json({
        success: false,
        message: 'Production not found'
      });
    }

    if (production.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Only pending productions can be rejected'
      });
    }

    production.status = 'REJECTED';
    production.rejected_by = req.user.id;
    production.rejected_at = new Date();
    production.rejection_reason = rejection_reason;

    await production.save();

    res.json({
      success: true,
      message: 'Production rejected successfully'
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   4️⃣ GET APPROVED PRODUCTIONS
========================================================= */
export const getApprovedProductions = async (req, res, next) => {
  try {
    const productions = await Production.findAll({
      where: { status: 'APPROVED' },
      order: [['approved_at', 'DESC']],
      include: [
        {
          model: ProductionItem,
          as: 'items',
          include: {
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }
        },
        {
          model: User,
          as: 'approvedBy',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({ success: true, data: productions });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   5️⃣ GET REJECTED PRODUCTIONS
========================================================= */
export const getRejectedProductions = async (req, res, next) => {
  try {
    const productions = await Production.findAll({
      where: { status: 'REJECTED' },
      order: [['rejected_at', 'DESC']],
      include: [
        {
          model: ProductionItem,
          as: 'items',
          include: {
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }
        },
        {
          model: User,
          as: 'rejectedBy',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({ success: true, data: productions });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   6️⃣ FULL PRODUCTION REPORT (FILTERABLE)
========================================================= */
export const getProductionReport = async (req, res, next) => {
  try {
    const { status, start_date, end_date } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }

    if (start_date && end_date) {
      where.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    }

    const productions = await Production.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: ProductionItem,
          as: 'items',
          include: {
            model: Product,
            as: 'product',
            attributes: ['id', 'name']
          }
        },
        {
          model: User,
          as: 'submittedBy',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'approvedBy',
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'rejectedBy',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json({
      success: true,
      total: productions.length,
      data: productions
    });

  } catch (error) {
    next(error);
  }
};

// get all productions
export const getAllProductions = async (req, res, next) => {
  try {
    // Pagination params from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: productions } = await Production.findAndCountAll({
      order: [["created_at", "DESC"]],
      limit,
      offset,
      attributes: ["id", "status", "created_at", "approved_at","approved_by", "approval_note", "submitted_by", "rejected_by", "rejection_reason", "rejected_at",],

      include: [
        {
          model: ProductionItem,
          as: "items",
          separate: true, // avoids huge join queries
          attributes: ["id", "product_id", "quantity", "production_time", "notes"],
          include: {
            model: Product,
            as: "product",
            attributes: ["id", "name", "barcode", "selling_price"],
          },
        },
        { model: User, as: "submittedBy", attributes: ["id", "full_name", "username"] },
        { model: User, as: "approvedBy", attributes: ["id", "full_name", "username"] },
        { model: User, as: "rejectedBy", attributes: ["id", "full_name", "username"] },
      ],
    });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      data: productions,
    });
  } catch (error) {
    next(error);
  }
};