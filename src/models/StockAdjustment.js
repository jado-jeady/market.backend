import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

class StockAdjustment extends Model {}

StockAdjustment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    type: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    previous_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    new_stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "StockAdjustment",
    tableName: "stock_adjustments",
    timestamps: true,
    underscored: true,
  }
);


export default StockAdjustment;