"use strict";
import sequelize from "../config/database.js";
import { Model, DataTypes } from "sequelize";

class Damage extends Model {}

Damage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // ── ref number shown in the UI e.g. DR-000001 ──
    ref_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    // ── FK → products ──
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "id" },
      onDelete: "RESTRICT",
    },

    // ── FK → users (who reported it) ──
    reported_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
    },

    damage_type: {
      type: DataTypes.ENUM(
        "Cover Breakage",
        "Water Leakage",
        "Rotten / Mold",
        "Electrical Failure",
        "Opened / Unsealed",
        "Missing Parts",
        "Physical Damage",
        "Scratches / Dents",
        "Other",
      ),
      allowNull: false,
    },

    severity: {
      type: DataTypes.ENUM("Minor", "Moderate", "Severe"),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("Pending", "InReview", "Resolved"),
      allowNull: false,
      defaultValue: "Pending",
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    incident_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    estimated_cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    witnesses: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ── Cloudinary URLs (stored as plain strings) ──
    image_1_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    image_2_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ── Cloudinary public_ids for future deletion ──
    image_1_public_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    image_2_public_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize: sequelize, // adjust path to your sequelize instance
    modelName: "Damage",
    tableName: "damages",
    underscored: true,
    timestamps: true, // created_at, updated_at
  },
);

export default Damage;
