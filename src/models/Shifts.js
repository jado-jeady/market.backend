import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import User from "./User.js";

class Shift extends Model {}

Shift.init(
  {
    shift_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cashier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },

    opening_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    closing_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    total_sales: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    expected_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    difference: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("OPEN", "CLOSED"),
      defaultValue: "OPEN",
    },

    opened_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    shop_name: {
      type: DataTypes.STRING,
      defaultValue: "Tygamarket",
    },
  },
  {
    sequelize,
    modelName: "Shift",
    tableName: "shifts",
    timestamps: true,
    underscored: true,
  }
);

export default Shift;
