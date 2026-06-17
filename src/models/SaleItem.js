import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class SaleItem extends Model {}

SaleItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    sale_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    product_name: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Snapshot of product name at sale time",
    },

    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    unit_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: "Price at time of sale",
    },

    total_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    is_refunded: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    with_bottle: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    },
    bottle_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      timestamps: true,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: true,
      timestamps: true,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },

  {
    sequelize,
    modelName: "SaleItem",
    tableName: "sale_items",
    timestamps: true,
    underscored: true,
  },
);

export default SaleItem;
