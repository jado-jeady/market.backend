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

    opening_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Opening momo balance at the start of the shift",
    },
    opening_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    closing_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Closing momo balance at the end of the shift",
    },
    closing_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cash_in_hand: {
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
    available_balance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "balance that a cashier has(cash and Momo)",
    },
    petty_cash: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "balance that a cashier starts with",
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
      defaultValue: "Tyga_market",
    },
    closed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      onDelete: "CASCADE",
    },
    consumables_snapshot: {
      type: DataTypes.JSONB, // Use DataTypes.JSONB if you are using PostgreSQL for better performance
      allowNull: true,
      comment:
        "Stores the state of consumables (name, qty, status) at the time of closing",
    },
    cash_withdrawal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Amount of cash withdrawn during the shift",
    },
    withdrawal_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when cash was withdrawn",
    },
  },
  {
    sequelize,
    modelName: "Shift",
    tableName: "shifts",
    timestamps: true,
    underscored: true,
  },
);

export default Shift;
