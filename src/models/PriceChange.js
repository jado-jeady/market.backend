// models/PriceChange.js
import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Product from "./Product.js";
import User from "./User.js";

class PriceChange extends Model {}

PriceChange.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "products",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    old_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    new_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    price_difference: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    change_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    change_type: {
      type: DataTypes.ENUM("INCREASE", "DECREASE", "UPDATE"),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "PriceChange",
    tableName: "price_changes",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default PriceChange;
