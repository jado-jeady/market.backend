import db from "../models/index.js";

import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";
import Op from "sequelize";

const { Damage, Product } = db;

// ── POST /api/damage-reports ──────────────────────────────────────────────────
export const createDamageReport = async (req, res, next) => {
  let img1Result = null;
  let img2Result = null;

  try {
    const {
      product_id,
      reported_by,
      ref_number,
      damage_type,
      severity,
      description,
      location,
      estimated_cost,
      witnesses,
      incident_date,
    } = req.body;

    console.log("Received damage report data:", req.body);
    if (
      !product_id ||
      !damage_type ||
      !severity ||
      !description ||
      !reported_by ||
      !incident_date ||
      !ref_number
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // Upload images to Cloudinary via streamifier (buffers from memoryStorage)
    const img1File = req.files?.image_1?.[0];
    const img2File = req.files?.image_2?.[0];

    if (img1File) {
      img1Result = await uploadToCloudinary(img1File.buffer, "damage_reports");
    }
    if (img2File) {
      img2Result = await uploadToCloudinary(img2File.buffer, "damage_reports");
    }

    const report = await Damage.create({
      product_id,
      ref_number,
      damage_type,
      severity,
      reported_by,
      description,
      location: location || null,
      estimated_cost: estimated_cost || null,
      witnesses: witnesses || null,
      incident_date,
      image_1_url: img1Result?.secure_url || null,
      image_1_public_id: img1Result?.public_id || null,
      image_2_url: img2Result?.secure_url || null,
      image_2_public_id: img2Result?.public_id || null,
    });

    const full = await Damage.findByPk(report.id, {
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
        },
      ],
    });

    return res.status(201).json({ success: true, data: full });
  } catch (err) {
    // DB failed after images uploaded — clean them up from Cloudinary
    if (img1Result?.public_id)
      await cloudinary.uploader.destroy(img1Result.public_id).catch(() => {});
    if (img2Result?.public_id)
      await cloudinary.uploader.destroy(img2Result.public_id).catch(() => {});

    next(err);
  }
};

// ── GET /api/damage-reports ───────────────────────────────────────────────────
export const getAllDamageReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { search, severity, status, product_id } = req.query;

    const where = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (product_id) where.product_id = product_id;

    if (search) {
      where[Op.or] = [{ reported_by_name: { [Op.iLike]: `%${search}%` } }];
    }

    const productWhere = {};
    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Damage.findAndCountAll({
      where,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
          // when searching, do an OUTER join so reporter-name matches still show
          // but product-name matches are also caught
          where: Object.keys(productWhere).length ? productWhere : undefined,
          required: false,
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
  } catch (err) {
    next(err);
  }
};

export const getMyDamageReports = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const { search, severity, status, product_id } = req.query;

    const where = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (product_id) where.product_id = product_id;

    if (search) {
      where[Op.or] = [{ reported_by_name: { [Op.iLike]: `%${search}%` } }];
    }

    const productWhere = {};
    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const userId = req.user.id; //req.user is being set by auth middleware

    const reports = await Damage.findAll({
      where: { ...where, reported_by: userId },
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
        },
      ],
    });

    return res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/damage-reports/:id ───────────────────────────────────────────────
export const getDamageReportById = async (req, res, next) => {
  try {
    const report = await Damage.findByPk(req.params.id, {
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["id", "name", "barcode"],
        },
      ],
    });
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });

    return res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/damage-reports/:id/status ─────────────────────────────────────
export const updateReportStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["Pending", "In Review", "Resolved"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }
    const report = await Damage.findByPk(req.params.id);
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });

    await report.update({ status });
    return res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/damage-reports/:id ───────────────────────────────────────────
export const deleteDamageReport = async (req, res, next) => {
  try {
    const report = await Damage.findByPk(req.params.id);
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found." });

    // Remove images from Cloudinary first
    if (report.image_1_public_id)
      await cloudinaryConfig.uploader
        .destroy(report.image_1_public_id)
        .catch(() => {});
    if (report.image_2_public_id)
      await cloudinaryConfig.uploader
        .destroy(report.image_2_public_id)
        .catch(() => {});

    await report.destroy();
    return res.json({ success: true, message: "Report deleted." });
  } catch (err) {
    next(err);
  }
};
