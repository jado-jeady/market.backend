import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";
import User from "./User.js";

class Shift extends Model {}

Shift.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cashier_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },

    business_date: {
      type: DataTypes.DATEONLY, // e.g., "2026-03-03"
      allowNull: false,
      comment: "Logical business date for reporting",
    },

    start_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    opening_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },

    closing_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    total_sales: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
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
      type: DataTypes.ENUM("OPEN", "CLOSED", "ABORTED"),
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