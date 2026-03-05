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
        model: User, // direct reference to User model
        key: "id",
      },
      onDelete: "CASCADE", // if cashier is deleted, remove shifts
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
    timestamps: true, // adds created_at and updated_at
    underscored: true, // snake_case columns
  }
);

export default Shift;