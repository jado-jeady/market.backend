import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database.js";

class Expense extends Model {}
Expense.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING, // Or use a Foreign Key to Category
      allowNull: false,
    },
    paymentMethod: {
      type: DataTypes.ENUM("cash", "momo", "card", "item-exchange"),
      defaultValue: "cash",
    },
    status: {
      type: DataTypes.ENUM("Pending", "Approved", "Aborted"),
      defaultValue: "Pending",
    },
    receiptUrl: {
      type: DataTypes.STRING, // Path to stored file
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approvedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shiftId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Expense",
    tableName: "expenses",
    timestamps: true, // Crucial for the 24-hour edit logic
  },
);

export default Expense;
